//AuthSchemas.ts

import { z } from "zod";

export const emailSchema = z.string().email().min(1).max(255);

const passwordSchema = z.string().min(6).max(255);

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  userAgent: z.string().optional(),
});

export const registerSchema = loginSchema.extend({
  fullName: z.string().min(2).max(100), // Only 'fullName' is required
});

export const verificationCodeSchema = z.string().min(1).max(25);

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  verificationCode: verificationCodeSchema,
});
