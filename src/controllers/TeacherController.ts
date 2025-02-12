import { Level, PrismaClient, Year } from "@prisma/client";
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

// Get teacher by ID
export const getTeacherByIdHandler = catchErrors(async (req, res) => {
  const teacherId = req.params.teacherId;

  const teacher = await prisma.teacher.findUnique({
    where: { teacherId },
    include: {
      user: true,
      subjects: true, // Include full subject details
    },
  });

  appAssert(teacher, NOT_FOUND, "Teacher not found");

  // Format the response
  const response = {
    ...teacher,
    // No need to map subjects to just names, as we are returning full subject details
  };

  return res.status(OK).json(response);
});

// Get all teachers
export const getAllTeachersHandler = catchErrors(async (req, res) => {
  const teachers = await prisma.teacher.findMany({
    include: {
      user: true,
      subjects: {
        where: {
          level: {
            in: ["PRIMARY", "MIDDLE", "SECONDARY"], // Ensure these values are valid strings
          },
        },
      },
    },
  });
  res.json(teachers);
});

// Add a teacher manually (admin only)
export const addTeacherHandler = catchErrors(async (req, res) => {
  const { email, password, firstName, lastName, subjects } = req.body;

  // Validate input
  appAssert(
    email && password && firstName && lastName,
    BAD_REQUEST,
    "Missing required fields"
  );

  // Check if email is already taken
  const existingUser = await prisma.user.findUnique({ where: { email } });
  appAssert(!existingUser, CONFLICT, "Email already in use");

  try {
    // Hash the password
    const hashedPassword = await hashValue(password);

    // Create the user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: "TEACHER",
      },
    });

    // Fetch existing subjects based on the names provided
    const existingSubjects = await prisma.subject.findMany({
      where: {
        name: {
          in: subjects.map((subject: { name: string }) => subject.name),
        },
      },
    });

    // Create the teacher and link them to existing subjects
    const teacher = await prisma.teacher.create({
      data: {
        userId: user.userId,
        subjects: {
          connect: existingSubjects.map((subject) => ({
            subjectId: subject.subjectId,
          })),
        },
      },
    });

    return res.status(CREATED).json({
      message: "Teacher added successfully",
      userId: user.userId,
      teacherId: teacher.teacherId,
    });
  } catch (error) {
    // If any error occurs, delete the user to avoid email conflicts
    await prisma.user.delete({ where: { email } }).catch(() => {});
    throw error;
  }
});

// Update a teacher's information
export const updateTeacherHandler = catchErrors(async (req, res) => {
  const teacherId = req.params.teacherId;
  const { subjects, firstName, lastName, email, bio } = req.body;

  // Fetch the teacher with subjects
  const teacher = await prisma.teacher.findUnique({
    where: { teacherId },
    include: { user: true, subjects: true },
  });
  appAssert(teacher, NOT_FOUND, "Teacher not found");

  // Authorization check
  const isAdmin = req.role === "ADMIN";
  const isTeacherUpdatingSelf = teacher.userId === req.userId;
  appAssert(
    isAdmin || isTeacherUpdatingSelf,
    FORBIDDEN,
    "You can only update your own information"
  );

  // Update the teacher's information
  const teacherUpdateData: any = {};

  if (subjects) {
    // Get existing subjects from the database that match the names
    const existingSubjects = await prisma.subject.findMany({
      where: {
        name: {
          in: subjects.map((s: { name: string }) => s.name),
        },
      },
    });

    // First disconnect all existing subjects
    teacherUpdateData.subjects = {
      disconnect: teacher.subjects.map((subject) => ({
        subjectId: subject.subjectId,
      })),
    };

    // Then connect to the new subjects (using subjectId)
    teacherUpdateData.subjects.connect = existingSubjects.map((subject) => ({
      subjectId: subject.subjectId,
    }));
  }

  if (bio) {
    teacherUpdateData.bio = bio;
  }

  // Update the teacher with the new subject connections
  const updatedTeacher = await prisma.teacher.update({
    where: { teacherId },
    data: teacherUpdateData,
    include: { subjects: true },
  });

  // Update user info if admin
  if (isAdmin) {
    const userUpdateData: any = {};
    if (firstName) userUpdateData.firstName = firstName;
    if (lastName) userUpdateData.lastName = lastName;
    if (email) userUpdateData.email = email;

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { userId: teacher.userId },
        data: userUpdateData,
      });
    }
  }

  return res.status(OK).json({
    message: "Teacher updated successfully",
    subjects: updatedTeacher.subjects,
  });
});

// Delete a teacher
export const deleteTeacherHandler = catchErrors(async (req, res) => {
  const teacherId = req.params.teacherId;

  // Ensure the teacher exists
  const teacher = await prisma.teacher.findUnique({
    where: { teacherId },
  });
  appAssert(teacher, NOT_FOUND, "Teacher not found");

  // Delete related records (e.g., Session)
  await prisma.session.deleteMany({
    where: { userId: teacher.userId },
  });

  // Delete the teacher
  await prisma.teacher.delete({
    where: { teacherId },
  });

  // Optionally, delete the associated user
  await prisma.user.delete({
    where: { userId: teacher.userId },
  });

  return res.status(OK).json({ message: "Teacher deleted successfully" });
});

// Get courses by teacher ID
export const getCoursesByTeacherIdHandler = catchErrors(async (req, res) => {
  const teacherId = req.userId;

  // Ensure the teacher exists
  const teacher = await prisma.teacher.findUnique({
    where: { userId: teacherId },
  });
  appAssert(teacher, NOT_FOUND, "Teacher not found");

  // Fetch courses by teacherId
  const courses = await prisma.course.findMany({
    where: { teacherId: teacher.teacherId },
    include: {
      teacher: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      subject: true,
      topics: {
        include: {
          contents: true,
        },
      },
    },
  });

  return res.status(OK).json(courses);
});

export const getTeacherSubjectsHandler = catchErrors(async (req, res) => {
  const teacherId = req.params.teacherId;

  // Validate input
  appAssert(teacherId, BAD_REQUEST, "Missing required field: teacherId");

  // Ensure the teacher exists
  const teacher = await prisma.teacher.findUnique({
    where: { teacherId },
    include: {
      subjects: true, // Include the subjects associated with the teacher
    },
  });

  appAssert(teacher, NOT_FOUND, "Teacher not found");

  // Format the response to include only the subject details
  const subjects = teacher.subjects.map((subject) => ({
    subjectId: subject.subjectId,
    name: subject.name,
    level: subject.level,
    stream: subject.stream,
    year: subject.year,
  }));

  return res.status(OK).json(subjects);
});
