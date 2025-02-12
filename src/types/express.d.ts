import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      userId: string;
      sessionId: string;
      role: string; // Add the role property
    }
  }
}
