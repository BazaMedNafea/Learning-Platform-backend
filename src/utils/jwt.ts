import jwt, { VerifyOptions, SignOptions } from "jsonwebtoken";
import Audience from "../constants/audience";
import { JWT_REFRESH_SECRET, JWT_SECRET } from "../constants/env";

// Define the payload types
export type RefreshTokenPayload = {
  sessionId: string;
};

export type AccessTokenPayload = {
  userId: string;
  sessionId: string;
  role: string; // Ensure the role is included
};

// Define the default options for signing tokens
const defaults: SignOptions = {
  audience: [Audience.User],
};

// Define the options for signing access tokens
const accessTokenSignOptions: SignOptions & { secret: string } = {
  expiresIn: "15m", // Access token expires in 15 minutes
  secret: JWT_SECRET, // Use the JWT secret from environment variables
};

// Define the options for signing refresh tokens
export const refreshTokenSignOptions: SignOptions & { secret: string } = {
  expiresIn: "30d", // Refresh token expires in 30 days
  secret: JWT_REFRESH_SECRET, // Use the JWT refresh secret from environment variables
};

// Function to sign a token
export const signToken = (
  payload: AccessTokenPayload | RefreshTokenPayload,
  options?: SignOptions & { secret: string }
) => {
  const { secret, ...signOpts } = options || accessTokenSignOptions;
  return jwt.sign(payload, secret, {
    ...defaults,
    ...signOpts,
  });
};

// Function to verify a token
export const verifyToken = <TPayload extends object = AccessTokenPayload>(
  token: string,
  options?: VerifyOptions & { secret?: string }
) => {
  const { secret = JWT_SECRET, ...verifyOpts } = options || {};
  try {
    const payload = jwt.verify(token, secret, {
      ...defaults,
      ...verifyOpts,
    }) as TPayload;
    return {
      payload,
    };
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
};
