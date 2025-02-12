import { PrismaClient } from "@prisma/client";
import {
  OK,
  NOT_FOUND,
  BAD_REQUEST,
  CONFLICT,
  CREATED,
  FORBIDDEN,
} from "../constants/http";
import appAssert from "../utils/appAssert";
import catchErrors from "../utils/catchErrors";
import { hashValue } from "../utils/bcrypt";

const prisma = new PrismaClient();

// Get all students (admin only)
export const getStudentsHandler = catchErrors(async (req, res) => {
  const students = await prisma.student.findMany({
    include: {
      parent: {
        include: {
          user: true, // Include the parent's user information
        },
      },
      grades: true,
    },
  });

  return res.status(OK).json(students);
});

// Get a student by ID (admin or parent of the student)
export const getStudentByIdHandler = catchErrors(async (req, res) => {
  const { studentId } = req.params;

  const student = await prisma.student.findUnique({
    where: { studentId },
    include: {
      parent: {
        include: {
          user: true, // Include the parent's user information
          students: true, // Include the parent's students
        },
      },
      grades: {
        include: {
          quiz: true,
          exam: true,
          course: true,
        },
      },
    },
  });

  appAssert(student, NOT_FOUND, "Student not found");

  // Check if the current user is the parent of the student or an admin
  const isAdmin = req.role === "ADMIN";
  const isParentOfStudent = student.parent.userId === req.userId;

  appAssert(
    isAdmin || isParentOfStudent,
    FORBIDDEN,
    "You are not authorized to view this student"
  );

  return res.status(OK).json(student);
});

// Add a student manually (admin only)
export const addStudentHandler = catchErrors(async (req, res) => {
  const { firstName, lastName, level, year, parentEmail, stream } = req.body;

  // Validate input
  appAssert(
    firstName && lastName && level && year && parentEmail,
    BAD_REQUEST,
    "Missing required fields"
  );

  // Validate stream if level is SECONDARY
  if (level === "SECONDARY" && !stream) {
    appAssert(
      false,
      BAD_REQUEST,
      "Stream is required for secondary level students"
    );
  }

  // Find the parent by email
  const parent = await prisma.parent.findFirst({
    where: {
      user: {
        email: parentEmail,
      },
    },
  });

  appAssert(parent, NOT_FOUND, "Parent not found");

  // Check if the parent already has a student with the same first and last name
  const existingStudent = await prisma.student.findFirst({
    where: {
      parentId: parent.parentId,
      firstName,
      lastName,
    },
  });

  appAssert(
    !existingStudent,
    CONFLICT,
    "A student with the same name already exists for this parent"
  );

  // Determine the approval status based on the role of the user adding the student
  const approvalStatus = req.role === "ADMIN" ? "APPROVED" : "PENDING";

  // Create the student and link them to the parent
  const student = await prisma.student.create({
    data: {
      firstName,
      lastName,
      level,
      year,
      stream, // Include the stream field
      parentId: parent.parentId, // Link to the parent
      approvalStatus, // Set the approval status based on the role
    },
  });

  return res.status(CREATED).json({
    message: "Student added successfully",
    studentId: student.studentId,
    parentId: student.parentId,
  });
});

// Update a student's information (admin or parent of the student)
export const updateStudentHandler = catchErrors(async (req, res) => {
  const { studentId } = req.params;
  const { firstName, lastName, level, year, parentId, stream } = req.body;

  // Validate input
  appAssert(
    studentId &&
      (firstName ||
        lastName ||
        level ||
        year ||
        parentId ||
        stream !== undefined),
    BAD_REQUEST,
    "Missing required fields"
  );

  // Find the student
  const student = await prisma.student.findUnique({
    where: { studentId },
    include: { parent: true }, // Include the parent
  });

  appAssert(student, NOT_FOUND, "Student not found");

  // Check if the current user is the parent of the student or an admin
  const isAdmin = req.role === "ADMIN";
  const isParentOfStudent = student.parent.userId === req.userId;

  appAssert(
    isAdmin || isParentOfStudent,
    FORBIDDEN,
    "You are not authorized to update this student"
  );

  // Update the student
  const studentUpdateData: any = {};
  if (firstName) studentUpdateData.firstName = firstName;
  if (lastName) studentUpdateData.lastName = lastName;
  if (level) studentUpdateData.level = level;
  if (year) studentUpdateData.year = year;
  if (parentId) studentUpdateData.parentId = parentId;

  // Handle the stream property
  if (level === "PRIMARY" || level === "MIDDLE") {
    studentUpdateData.stream = null; // Set stream to undefined if level is PRIMARY or MIDDLE
  } else if (stream !== undefined) {
    studentUpdateData.stream = stream; // Set stream to the provided value if level is SECONDARY
  }

  await prisma.student.update({
    where: { studentId },
    data: studentUpdateData,
  });

  return res.status(OK).json({ message: "Student updated successfully" });
});

// Delete a student (admin only)
export const deleteStudentHandler = catchErrors(async (req, res) => {
  const { studentId } = req.params;

  // Ensure the student exists
  const student = await prisma.student.findUnique({ where: { studentId } });
  appAssert(student, NOT_FOUND, "Student not found");

  // Delete related records (e.g., Grades)
  await prisma.grade.deleteMany({ where: { studentId } });

  // Delete the student
  await prisma.student.delete({ where: { studentId } });

  return res.status(OK).json({ message: "Student deleted successfully" });
});

export const getStudentsByParentIdHandler = catchErrors(async (req, res) => {
  const { parentId } = req.params;

  // Find the parent first to ensure they exist
  const parent = await prisma.parent.findUnique({
    where: { parentId },
    include: {
      user: true,
    },
  });

  appAssert(parent, NOT_FOUND, "Parent not found");

  // Check if the current user is the parent or an admin
  const isAdmin = req.role === "ADMIN";
  const isRequestingParent = parent.userId === req.userId;

  appAssert(
    isAdmin || isRequestingParent,
    FORBIDDEN,
    "You are not authorized to view these students"
  );

  // Get all students for the parent
  const students = await prisma.student.findMany({
    where: { parentId },
    include: {
      grades: {
        include: {
          quiz: true,
          exam: true,
          course: true,
        },
      },
      Enrollment: true,
    },
  });

  return res.status(OK).json(students);
});
