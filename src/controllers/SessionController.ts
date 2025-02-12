//SessionController.ts

import { z } from "zod";
import { NOT_FOUND, OK } from "../constants/http";
import { PrismaClient } from "@prisma/client";
import catchErrors from "../utils/catchErrors";
import appAssert from "../utils/appAssert";

// Initialize Prisma Client
const prisma = new PrismaClient();

export const getSessionsHandler = catchErrors(async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: {
      userId: req.userId,
      expiresAt: {
        gt: new Date(), // Prisma uses Date object for comparisons
      },
    },
    select: {
      sessionId: true,
      userAgent: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return res.status(OK).json(
    // mark the current session
    sessions.map((session) => ({
      id: session.sessionId,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      ...(session.sessionId === req.sessionId && {
        isCurrent: true,
      }),
    }))
  );
});

export const deleteSessionHandler = catchErrors(async (req, res) => {
  const sessionId = z.string().parse(req.params.id);
  const deleted = await prisma.session.delete({
    where: {
      sessionId: sessionId,
      userId: req.userId,
    },
  });

  // Prisma throws an error if no record is found, so we don't need explicit check
  return res.status(OK).json({ message: "Session removed" });
});
