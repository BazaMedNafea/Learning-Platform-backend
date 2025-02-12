import { PrismaClient } from "@prisma/client";
import { OK, NOT_FOUND, BAD_REQUEST } from "../constants/http";
import appAssert from "../utils/appAssert";
import catchErrors from "../utils/catchErrors";
import { z } from "zod";

const prisma = new PrismaClient();

// Enhanced schema for updating a user
const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
});

// Get public user information (Public)
export const getUserPublicInfoHandler = catchErrors(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { userId: req.params.userId },
    select: {
      userId: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });

  appAssert(user, NOT_FOUND, "User not found");

  return res.status(OK).json(user);
});

// Get authenticated user's information (Authenticated)
export const getUserInfoHandler = catchErrors(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { userId: req.userId },
    select: {
      userId: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      updatedAt: true,
      phoneNumber: true,
      address: true,
      teacher: {
        select: {
          teacherId: true,
          bio: true,
        },
      },
      parent: {
        select: {
          parentId: true,
          approvalStatus: true,
        },
      },
    },
  });

  appAssert(user, NOT_FOUND, "User not found");

  const response = {
    userId: user.userId,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    address: user.address,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    teacherId: user.teacher?.teacherId,
    teacherBio: user.teacher?.bio,
    parentId: user.parent?.parentId,
    approvalStatus: user.parent?.approvalStatus,
  };

  return res.status(OK).json(response);
});

// Update authenticated user's information (Authenticated)
export const updateUserInfoHandler = catchErrors(async (req, res) => {
  const request = updateUserSchema.parse(req.body);

  const updateData: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    address?: string;
  } = {};

  // Check email uniqueness if email is being updated
  if (request.email) {
    const existingUser = await prisma.user.findFirst({
      where: {
        AND: [{ email: request.email }, { NOT: { userId: req.userId } }],
      },
    });
    appAssert(!existingUser, BAD_REQUEST, "Email already in use");
    updateData.email = request.email;
  }

  // Add other fields to update data if they are provided
  if (request.firstName) updateData.firstName = request.firstName;
  if (request.lastName) updateData.lastName = request.lastName;
  if (request.phoneNumber) updateData.phoneNumber = request.phoneNumber;
  if (request.address) updateData.address = request.address;

  // Ensure there's something to update
  appAssert(
    Object.keys(updateData).length > 0,
    BAD_REQUEST,
    "No fields to update"
  );

  const updatedUser = await prisma.user.update({
    where: { userId: req.userId },
    data: updateData,
    select: {
      userId: true,
      email: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      address: true,
      updatedAt: true,
    },
  });

  return res.status(OK).json(updatedUser);
});
