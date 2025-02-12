// AuthController.ts

import { PrismaClient } from "@prisma/client";
import { APP_ORIGIN } from "../constants/env";
import {
  CONFLICT,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  TOO_MANY_REQUESTS,
  UNAUTHORIZED,
  CREATED,
  OK,
  BAD_REQUEST,
} from "../constants/http";
import VerificationCodeType from "../constants/verificationCodeType";
import appAssert from "../utils/appAssert";
import { hashValue, compareValue } from "../utils/bcrypt";
import {
  ONE_DAY_MS,
  fiveMinutesAgo,
  oneHourFromNow,
  oneYearFromNow,
  thirtyDaysFromNow,
} from "../utils/date";
import {
  getPasswordResetTemplate,
  getVerifyEmailTemplate,
} from "../utils/emailTemplates";
import {
  RefreshTokenPayload,
  refreshTokenSignOptions,
  signToken,
  verifyToken,
} from "../utils/jwt";

import catchErrors from "../utils/catchErrors";
import {
  emailSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verificationCodeSchema,
} from "../schemas/AuthSchemas";
import {
  clearAuthCookies,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  setAuthCookies,
} from "../utils/cookies";
import AppError from "../utils/AppError";

const prisma = new PrismaClient();

export const registerHandler = catchErrors(async (req, res) => {
  const { email, password, firstName, lastName, role, additionalData } =
    req.body;

  // Validate role
  const validRoles = ["PARENT", "TEACHER", "ADMIN"];
  appAssert(validRoles.includes(role), BAD_REQUEST, "Invalid role");

  // Check if email is already taken
  const existingUser = await prisma.user.findUnique({ where: { email } });
  appAssert(!existingUser, CONFLICT, "Email already in use");

  // Hash the password
  const hashedPassword = await hashValue(password);

  // Extract common user data including phone number and address for all roles
  const userData = {
    email,
    password: hashedPassword,
    firstName,
    lastName,
    role,
  };

  // Create the user
  const user = await prisma.user.create({
    data: userData,
  });

  // Role-specific logic
  if (role === "PARENT") {
    const { students } = additionalData;

    // Create parent
    await prisma.parent.create({
      data: {
        userId: user.userId,
        students: {
          connect: students.map((studentId: string) => ({ studentId })),
        },
      },
    });
  } else if (role === "TEACHER") {
    const { subjects, bio } = additionalData;

    await prisma.teacher.create({
      data: {
        userId: user.userId,
        bio,
        subjects: {
          connectOrCreate: subjects.map((subjectName: string) => ({
            where: { name: subjectName },
            create: { name: subjectName },
          })),
        },
      },
    });
  }

  // Create session
  const session = await prisma.session.create({
    data: {
      userId: user.userId,
      userAgent: req.headers["user-agent"] || "",
      expiresAt: thirtyDaysFromNow(),
    },
  });

  // Generate tokens
  const refreshToken = signToken(
    { sessionId: session.sessionId },
    refreshTokenSignOptions
  );
  const accessToken = signToken({
    userId: user.userId,
    sessionId: session.sessionId,
    role: user.role,
  });

  // Set cookies and respond
  return setAuthCookies({ res, accessToken, refreshToken })
    .status(CREATED)
    .json({ userId: user.userId, role: user.role });
});

export const loginHandler = catchErrors(async (req, res) => {
  let request;
  try {
    request = loginSchema.parse({
      ...req.body,
      userAgent: req.headers["user-agent"],
    });
  } catch (error) {
    // Handle Zod validation errors and return a generic message
    throw new AppError(UNAUTHORIZED, "Invalid email or password");
  }

  const user = await prisma.user.findUnique({
    where: { email: request.email },
  });

  // Generic error message to avoid revealing whether the email exists
  appAssert(user, UNAUTHORIZED, "Invalid email or password");

  const isValid = await compareValue(request.password, user.password);
  appAssert(isValid, UNAUTHORIZED, "Invalid email or password");

  const session = await prisma.session.create({
    data: {
      userId: user.userId,
      userAgent: request.userAgent,
      expiresAt: thirtyDaysFromNow(),
    },
  });

  const sessionInfo: RefreshTokenPayload = {
    sessionId: session.sessionId,
  };

  const refreshToken = signToken(sessionInfo, refreshTokenSignOptions);
  const accessToken = signToken({
    ...sessionInfo,
    userId: user.userId,
    role: user.role, // Include role in the token payload
  });

  return setAuthCookies({ res, accessToken, refreshToken })
    .status(OK)
    .json({ message: "Login successful" });
});

export const logoutHandler = catchErrors(async (req, res) => {
  const accessToken = req.cookies.accessToken as string | undefined;

  // If the access token exists, verify it and extract the payload
  if (accessToken) {
    const { payload } = verifyToken(accessToken || "");

    if (payload) {
      console.log("Deleting session for sessionId:", payload.sessionId);

      // Clear cookies explicitly (clear both access and refresh token cookies)
      clearAuthCookies(res);

      // Remove session from the database
      await prisma.session.delete({
        where: { sessionId: payload.sessionId },
      });
    }
  }

  // Clear cookies if no access token is found
  return clearAuthCookies(res)
    .status(OK)
    .json({ message: "Logout successful" });
});

export const refreshHandler = catchErrors(async (req, res) => {
  const refreshToken = req.cookies.refreshToken as string | undefined;
  appAssert(refreshToken, UNAUTHORIZED, "Missing refresh token");

  const { payload } = verifyToken<RefreshTokenPayload>(refreshToken, {
    secret: refreshTokenSignOptions.secret,
  });
  appAssert(payload, UNAUTHORIZED, "Invalid refresh token");

  const session = await prisma.session.findUnique({
    where: { sessionId: payload.sessionId },
  });

  const now = Date.now();
  appAssert(
    session && session.expiresAt.getTime() > now,
    UNAUTHORIZED,
    "Session expired"
  );

  // Refresh the session if it expires in the next 24hrs
  const sessionNeedsRefresh = session.expiresAt.getTime() - now <= ONE_DAY_MS;
  let newRefreshToken;
  if (sessionNeedsRefresh) {
    await prisma.session.update({
      where: { sessionId: session.sessionId },
      data: { expiresAt: thirtyDaysFromNow() },
    });

    newRefreshToken = signToken(
      { sessionId: session.sessionId },
      refreshTokenSignOptions
    );
  }

  const user = await prisma.user.findUnique({
    where: { userId: session.userId },
  });
  appAssert(user, UNAUTHORIZED, "User not found");

  const accessToken = signToken({
    userId: session.userId,
    sessionId: session.sessionId,
    role: user.role,
  });

  if (newRefreshToken) {
    res.cookie("refreshToken", newRefreshToken, getRefreshTokenCookieOptions());
  }
  return res
    .status(OK)
    .cookie("accessToken", accessToken, getAccessTokenCookieOptions())
    .json({ message: "Access token refreshed" });
});
