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

// Get all parents (admin only)
export const getParentsHandler = catchErrors(async (req, res) => {
  const parents = await prisma.parent.findMany({
    include: {
      user: true,
    },
  });

  return res.status(OK).json(parents);
});

// Get a parent by ID (admin only)
export const getParentByIdHandler = catchErrors(async (req, res) => {
  const parentId = req.params.parentId;

  const parent = await prisma.parent.findUnique({
    where: { parentId },
    include: {
      user: true,
      students: true,
    },
  });

  appAssert(parent, NOT_FOUND, "Parent not found");

  return res.status(OK).json(parent);
});

// Add a parent manually (admin only)
export const addParentHandler = catchErrors(async (req, res) => {
  const { email, password, firstName, lastName, phoneNumber, address } =
    req.body;

  // Validate input
  appAssert(
    email && password && firstName && lastName,
    BAD_REQUEST,
    "Missing required fields"
  );

  // Check if email is already taken
  const existingUser = await prisma.user.findUnique({ where: { email } });
  appAssert(!existingUser, CONFLICT, "Email already in use");

  // Hash the password
  const hashedPassword = await hashValue(password);

  // Create the user with phone and address
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: "PARENT",
      firstName,
      lastName,
      phoneNumber,
      address,
    },
  });

  // Determine the approval status based on the role of the user adding the parent
  const approvalStatus = req.role === "ADMIN" ? "APPROVED" : "PENDING";

  // Create the parent and link them to the user
  const parent = await prisma.parent.create({
    data: {
      userId: user.userId,
      approvalStatus,
    },
  });

  return res.status(CREATED).json({
    message: "Parent added successfully",
    userId: user.userId,
    parentId: parent.parentId,
  });
});

// Edit a parent (admin only)
export const editParentHandler = catchErrors(async (req, res) => {
  const { parentId } = req.params;
  const { email, firstName, lastName, phoneNumber, address } = req.body;

  // Validate input
  appAssert(
    parentId && (email || firstName || lastName || phoneNumber || address),
    BAD_REQUEST,
    "Missing required fields"
  );

  // Find the parent
  const parent = await prisma.parent.findUnique({ where: { parentId } });
  appAssert(parent, NOT_FOUND, "Parent not found");

  // Update the user including phone and address
  const user = await prisma.user.update({
    where: { userId: parent.userId },
    data: {
      email,
      firstName,
      lastName,
      phoneNumber,
      address,
    },
  });

  return res.status(OK).json({
    message: "Parent updated successfully",
    userId: user.userId,
    parentId: parent.parentId,
  });
});

// Delete a parent (admin only)
export const deleteParentHandler = catchErrors(async (req, res) => {
  const { parentId } = req.params;

  // Find the parent
  const parent = await prisma.parent.findUnique({ where: { parentId } });
  appAssert(parent, NOT_FOUND, "Parent not found");

  // Delete the parent
  await prisma.parent.delete({ where: { parentId } });

  // Delete the user
  await prisma.user.delete({ where: { userId: parent.userId } });

  return res.status(OK).json({ message: "Parent deleted successfully" });
});

// Get students of a parent by parent ID
export const getParentStudentsHandler = catchErrors(async (req, res) => {
  const parentId = req.params.parentId;

  const parent = await prisma.parent.findUnique({
    where: { parentId },
    include: {
      students: true,
    },
  });

  appAssert(parent, NOT_FOUND, "Parent not found");

  return res.status(OK).json(parent.students);
});

// Function to enroll a student in a course
export const enrollStudentToCourseHandler = catchErrors(async (req, res) => {
  const { parentId, studentId, courseId } = req.body;

  // Validate input
  appAssert(
    parentId && studentId && courseId,
    BAD_REQUEST,
    "Missing required fields: parentId, studentId, courseId"
  );

  // Find the parent
  const parent = await prisma.parent.findUnique({
    where: { parentId },
    include: {
      user: true,
      students: true,
    },
  });
  appAssert(parent, NOT_FOUND, "Parent not found");

  // Find the student
  const student = parent.students.find((s) => s.studentId === studentId);
  appAssert(
    student,
    NOT_FOUND,
    "Student not found or not linked to the parent"
  );

  // Find the course
  const course = await prisma.course.findUnique({
    where: { courseId },
  });
  appAssert(course, NOT_FOUND, "Course not found");

  // Check if the student is already enrolled in the course
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: {
      studentId,
      courseId,
    },
  });
  appAssert(
    !existingEnrollment,
    CONFLICT,
    "Student is already enrolled in this course"
  );

  // Determine the enrollment status based on the course's isPublic property
  const enrollmentStatus = course.isPublic ? "APPROVED" : "PENDING";

  // Create the enrollment
  const enrollment = await prisma.enrollment.create({
    data: {
      studentId,
      parentId,
      courseId,
      status: enrollmentStatus,
    },
  });

  return res.status(CREATED).json({
    message: "Student enrolled successfully",
    enrollmentId: enrollment.enrollmentId,
    status: enrollmentStatus,
  });
});

// Function to unenroll a student from a course
export const unenrollStudentFromCourseHandler = catchErrors(
  async (req, res) => {
    const { parentId, studentId, courseId } = req.body;

    // Validate input
    appAssert(
      parentId && studentId && courseId,
      BAD_REQUEST,
      "Missing required fields: parentId, studentId, courseId"
    );

    // Find the parent
    const parent = await prisma.parent.findUnique({
      where: { parentId },
      include: {
        user: true,
        students: true,
      },
    });
    appAssert(parent, NOT_FOUND, "Parent not found");

    // Find the student
    const student = parent.students.find((s) => s.studentId === studentId);
    appAssert(
      student,
      NOT_FOUND,
      "Student not found or not linked to the parent"
    );

    // Find the enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
    });
    appAssert(enrollment, NOT_FOUND, "Enrollment not found");

    // Delete the enrollment
    await prisma.enrollment.delete({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
    });

    return res.status(OK).json({ message: "Student unenrolled successfully" });
  }
);
