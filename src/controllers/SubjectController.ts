// SubjectController.ts
import { PrismaClient, Stream } from "@prisma/client";
import { CREATED, OK, BAD_REQUEST, NOT_FOUND } from "../constants/http";
import appAssert from "../utils/appAssert";
import catchErrors from "../utils/catchErrors";

const prisma = new PrismaClient();

// Add a new subject (Admin only)
export const addSubjectHandler = catchErrors(async (req, res) => {
  const { name, level, stream } = req.body;

  // Validate stream based on level
  appAssert(
    level === "SECONDARY" ? !!stream : !stream,
    BAD_REQUEST,
    level === "SECONDARY"
      ? "Stream is required for secondary subjects"
      : "Stream should not be provided for primary/middle subjects"
  );

  // Check for existing subject
  const existingSubject = await prisma.subject.findFirst({
    where: { name, level, stream },
  });
  appAssert(!existingSubject, BAD_REQUEST, "Subject already exists");

  const newSubject = await prisma.subject.create({
    data: {
      name,
      level,
      stream: level === "SECONDARY" ? stream : null,
      year: req.body.year, // Ensure 'year' is provided in the request body
    },
  });

  return res.status(CREATED).json(newSubject);
});

// Get subjects by level (Public)
export const getSubjectsByLevelHandler = catchErrors(async (req, res) => {
  const { level } = req.params;
  appAssert(
    ["PRIMARY", "MIDDLE", "SECONDARY"].includes(level),
    BAD_REQUEST,
    "Invalid level"
  );

  const subjects = await prisma.subject.findMany({
    where: { level: level as "PRIMARY" | "MIDDLE" | "SECONDARY" },
    select: {
      subjectId: true,
      name: true,
      level: true,
      stream: true,
      year: true,
    },
  });

  return res.status(OK).json(subjects);
});

// Get subjects by stream (For secondary level)
export const getSubjectsByStreamHandler = catchErrors(async (req, res) => {
  const { stream } = req.params;
  appAssert(
    ["SCIENCES", "MATHEMATICS", "LITERATURE", "TECHNICAL"].includes(stream),
    BAD_REQUEST,
    "Invalid stream"
  );

  const subjects = await prisma.subject.findMany({
    where: {
      level: "SECONDARY",
      stream: stream as Stream,
    },
  });

  return res.status(OK).json(subjects);
});

// Delete subject (Admin only)
export const deleteSubjectHandler = catchErrors(async (req, res) => {
  const { subjectId } = req.params;

  const subject = await prisma.subject.delete({
    where: { subjectId },
  });
  appAssert(subject, NOT_FOUND, "Subject not found");

  return res.status(OK).json({ message: "Subject deleted successfully" });
});
