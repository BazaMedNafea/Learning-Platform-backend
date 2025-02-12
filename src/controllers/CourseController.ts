// CourseController.ts
import { PrismaClient } from "@prisma/client";
import {
  OK,
  CREATED,
  BAD_REQUEST,
  NOT_FOUND,
  UNAUTHORIZED,
} from "../constants/http";

import appAssert from "../utils/appAssert";
import catchErrors from "../utils/catchErrors";

const prisma = new PrismaClient();

// Create a new course
export const createCourseHandler = catchErrors(async (req, res) => {
  const { title, description, isPublic, subjectId, image } = req.body;
  const teacherId = req.userId;

  console.log(`Creating course with teacherId: ${teacherId}`);
  console.log(`Received data:`, req.body);

  // Validate input
  appAssert(title, BAD_REQUEST, "Missing required field: title");
  appAssert(description, BAD_REQUEST, "Missing required field: description");
  appAssert(
    isPublic !== undefined,
    BAD_REQUEST,
    "Missing required field: isPublic"
  );
  appAssert(subjectId, BAD_REQUEST, "Missing required field: subjectId");
  appAssert(image, BAD_REQUEST, "Missing required field: image");

  // Ensure the teacher exists
  const teacher = await prisma.teacher.findUnique({
    where: { userId: teacherId },
  });
  if (!teacher) {
    console.error(`Teacher with userId ${teacherId} not found`);
    return res.status(NOT_FOUND).json({ error: "Teacher not found" });
  }

  console.log(`Teacher found: ${JSON.stringify(teacher)}`);

  // Parse isPublic as a boolean
  const isPublicBoolean = isPublic === "true" || isPublic === true;

  // Create the course
  try {
    const course = await prisma.course.create({
      data: {
        title,
        description,
        isPublic: isPublicBoolean, // Use the parsed boolean value
        teacherId: teacher.teacherId, // Use the correct teacherId
        subjectId,
        image, // Directly use the Base64 image string
      },
    });
    return res.status(CREATED).json(course);
  } catch (error) {
    console.error(`Error creating course: ${error}`);
    return res.status(BAD_REQUEST).json({ error: "Failed to create course" });
  }
});

// Get all courses (requires authentication and teacher role)
export const getAllCoursesHandler = catchErrors(async (req, res) => {
  const courses = await prisma.course.findMany({
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
    },
  });

  return res.status(OK).json(courses);
});

// Get public courses (no authentication required)
export const getPublicCoursesHandler = catchErrors(async (req, res) => {
  const publicCourses = await prisma.course.findMany({
    where: {
      isPublic: true,
    },
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

  return res.status(OK).json(publicCourses);
});

// Add a topic to a course
export const addTopicToCourseHandler = catchErrors(async (req, res) => {
  const courseId = req.params.courseId; // Get courseId from URL params
  const { title } = req.body; // Get title from body
  const teacherId = req.userId;

  console.log(`Adding topic to course with courseId: ${courseId}`);
  console.log(`Received data:`, req.body);

  // Validate input
  appAssert(courseId && title, BAD_REQUEST, "Missing required fields");

  // Ensure the course exists and belongs to the teacher
  const course = await prisma.course.findUnique({
    where: { courseId },
    select: { teacher: { select: { userId: true } } }, // Only select teacher's userId
  });
  appAssert(course, NOT_FOUND, "Course not found");
  appAssert(
    course.teacher.userId === teacherId,
    UNAUTHORIZED,
    "Unauthorized to add topic to this course"
  );

  // Create the topic
  const topic = await prisma.topic.create({
    data: {
      title,
      courseId,
    },
  });

  return res.status(CREATED).json(topic);
});
// Add content to a topic
export const addContentToTopicHandler = catchErrors(async (req, res) => {
  const topicId = req.params.topicId; // Get topicId from URL params
  const { type, data } = req.body;
  const teacherId = req.userId;

  // Validate input
  appAssert(topicId && type && data, BAD_REQUEST, "Missing required fields");

  // Ensure the topic exists and belongs to a course that the teacher owns
  const topic = await prisma.topic.findUnique({
    where: { topicId },
    include: { course: { include: { teacher: true } } }, // Ensure teacher is included for authorization check
  });
  appAssert(topic, NOT_FOUND, "Topic not found");
  appAssert(
    topic.course.teacher.userId === teacherId,
    UNAUTHORIZED,
    "Unauthorized to add content to this topic"
  );

  // Validate content type
  const validTypes = ["TEXT", "LINK", "YOUTUBE_VIDEO"];
  appAssert(validTypes.includes(type), BAD_REQUEST, "Invalid content type");

  // Create the content
  const content = await prisma.content.create({
    data: {
      type,
      data,
      topicId,
    },
  });

  return res.status(CREATED).json(content);
});

// Delete a course
export const deleteCourseHandler = catchErrors(async (req, res) => {
  const courseId = req.params.courseId;
  const teacherId = req.userId;

  // Ensure the course exists and belongs to the teacher
  const course = await prisma.course.findUnique({
    where: { courseId },
    include: { teacher: true },
  });
  appAssert(course, NOT_FOUND, "Course not found");
  appAssert(
    course.teacher.userId === teacherId,
    UNAUTHORIZED,
    "Unauthorized to delete this course"
  );

  // Delete the course
  await prisma.course.delete({
    where: { courseId },
  });

  return res.status(OK).json({ message: "Course deleted successfully" });
});

// Update a course
export const updateCourseHandler = catchErrors(async (req, res) => {
  const courseId = req.params.courseId;
  const teacherId = req.userId;
  const { title, description, isPublic, subjectId, image } = req.body;

  console.log(`Updating course with courseId: ${courseId}`);
  console.log(`Received data:`, req.body);

  // Ensure the course exists and belongs to the teacher
  const course = await prisma.course.findUnique({
    where: { courseId },
    include: { teacher: true },
  });
  appAssert(course, NOT_FOUND, "Course not found");
  appAssert(
    course.teacher.userId === teacherId,
    UNAUTHORIZED,
    "Unauthorized to update this course"
  );

  // Parse isPublic as a boolean
  const isPublicBoolean = isPublic === "true" || isPublic === true;

  // Update the course
  const updatedCourse = await prisma.course.update({
    where: { courseId },
    data: {
      title,
      description,
      isPublic: isPublicBoolean, // Use the parsed boolean value
      subjectId,
      image, // Directly use the Base64 image string
    },
  });

  console.log(`Course updated successfully:`, updatedCourse);

  return res.status(OK).json(updatedCourse);
});

// Update a topic
export const updateTopicHandler = catchErrors(async (req, res) => {
  const topicId = req.params.topicId;
  const teacherId = req.userId;
  const { title } = req.body;

  // Ensure the topic exists and belongs to a course that the teacher owns
  const topic = await prisma.topic.findUnique({
    where: { topicId },
    include: { course: { include: { teacher: true } } },
  });
  appAssert(topic, NOT_FOUND, "Topic not found");
  appAssert(
    topic.course.teacher.userId === teacherId,
    UNAUTHORIZED,
    "Unauthorized to update this topic"
  );

  // Update the topic
  const updatedTopic = await prisma.topic.update({
    where: { topicId },
    data: {
      title,
    },
  });

  return res.status(OK).json(updatedTopic);
});

// Update content
export const updateContentHandler = catchErrors(async (req, res) => {
  const contentId = req.params.contentId;
  const teacherId = req.userId;
  const { type, data } = req.body;

  // Ensure the content exists and belongs to a topic that the teacher owns
  const content = await prisma.content.findUnique({
    where: { contentId },
    include: { topic: { include: { course: { include: { teacher: true } } } } },
  });
  appAssert(content, NOT_FOUND, "Content not found");
  appAssert(
    content.topic.course.teacher.userId === teacherId,
    UNAUTHORIZED,
    "Unauthorized to update this content"
  );

  // Update the content
  const updatedContent = await prisma.content.update({
    where: { contentId },
    data: {
      type,
      data,
    },
  });

  return res.status(OK).json(updatedContent);
});

// Delete content
export const deleteContentHandler = catchErrors(async (req, res) => {
  const contentId = req.params.contentId;
  const teacherId = req.userId;

  // Ensure the content exists and belongs to a topic that the teacher owns
  const content = await prisma.content.findUnique({
    where: { contentId },
    include: { topic: { include: { course: { include: { teacher: true } } } } },
  });
  appAssert(content, NOT_FOUND, "Content not found");
  appAssert(
    content.topic.course.teacher.userId === teacherId,
    UNAUTHORIZED,
    "Unauthorized to delete this content"
  );

  // Delete the content
  await prisma.content.delete({
    where: { contentId },
  });

  return res.status(OK).json({ message: "Content deleted successfully" });
});

// Get a Course By Id
export const getCourseByIdHandler = catchErrors(async (req, res) => {
  const courseId = req.params.courseId;

  // Ensure the course exists
  const course = await prisma.course.findUnique({
    where: { courseId },
    include: {
      topics: {
        include: {
          contents: true,
        },
      },
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
      enrollments: true,
      subject: true,
      quizzes: true, // Include quizzes if needed
      exams: true, // Include exams if needed
    },
  });
  appAssert(course, NOT_FOUND, "Course not found");

  return res.status(OK).json(course);
});

// Delete a topic
export const deleteTopicHandler = catchErrors(async (req, res) => {
  const topicId = req.params.topicId;
  const teacherId = req.userId;

  // Ensure the topic exists and belongs to a course that the teacher owns
  const topic = await prisma.topic.findUnique({
    where: { topicId },
    include: { course: { include: { teacher: true } } },
  });
  appAssert(topic, NOT_FOUND, "Topic not found");
  appAssert(
    topic.course.teacher.userId === teacherId,
    UNAUTHORIZED,
    "Unauthorized to delete this topic"
  );

  // Delete the topic
  await prisma.topic.delete({
    where: { topicId },
  });

  return res.status(OK).json({ message: "Topic deleted successfully" });
});

// Get content of a topic
export const getTopicContentHandler = catchErrors(async (req, res) => {
  const topicId = req.params.topicId;

  // Ensure the topic exists
  const topic = await prisma.topic.findUnique({
    where: { topicId },
    include: {
      contents: true,
    },
  });
  appAssert(topic, NOT_FOUND, "Topic not found");

  return res.status(OK).json(topic.contents);
});

// Get enrolled students for a course
export const getEnrolledStudentsHandler = catchErrors(async (req, res) => {
  const courseId = req.params.courseId;

  // Validate input
  appAssert(courseId, BAD_REQUEST, "Missing required field: courseId");

  // Fetch the course with enrolled students and their details
  const courseWithEnrollments = await prisma.course.findUnique({
    where: { courseId },
    include: {
      enrollments: {
        include: {
          student: {
            include: {
              User: true, // Include the User model via the userUserId relationship
            },
          },
          parent: {
            include: {
              user: true, // Include the User model for the parent
            },
          },
        },
      },
    },
  });

  // Ensure the course exists
  appAssert(courseWithEnrollments, NOT_FOUND, "Course not found");

  // Explicitly type the courseWithEnrollments object
  type CourseWithEnrollments = typeof courseWithEnrollments & {
    enrollments: {
      student: {
        studentId: any;
        firstName: string;
        lastName: string;
        user: {
          firstName: string;
          lastName: string;
          email: string;
        };
      };
      parent: {
        user: {
          firstName: string;
          lastName: string;
          email: string;
        };
      };
      status: string;
      enrolledAt: Date;
    }[];
  };

  const typedCourseWithEnrollments =
    courseWithEnrollments as CourseWithEnrollments;

  // Extract the enrolled students and their details
  const enrolledStudents = typedCourseWithEnrollments.enrollments.map(
    (enrollment) => {
      // Use the student's firstName and lastName if available, otherwise fall back to the user's firstName and lastName
      const studentName =
        enrollment.student.firstName && enrollment.student.lastName
          ? `${enrollment.student.firstName} ${enrollment.student.lastName}`
          : enrollment.student.User
          ? `${enrollment.student.User.firstName} ${enrollment.student.User.lastName}`
          : "";

      return {
        studentId: enrollment.student.studentId,
        studentName, // Use the resolved student name
        studentEmail: enrollment.student.User?.email,
        parentName: `${enrollment.parent.user.firstName} ${enrollment.parent.user.lastName}`,
        parentEmail: enrollment.parent.user.email,
        enrollmentStatus: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
      };
    }
  );

  return res.status(OK).json(enrolledStudents);
});

// Approve a student's enrollment in a course
export const approveEnrollmentHandler = catchErrors(async (req, res) => {
  const { courseId, studentId } = req.params; // Get courseId and studentId from URL params
  const teacherId = req.userId; // Get the teacher's ID from the request

  console.log(
    `Approving enrollment for studentId: ${studentId} in courseId: ${courseId}`
  );

  // Validate input
  appAssert(
    courseId && studentId,
    BAD_REQUEST,
    "Missing required fields: courseId or studentId"
  );

  // Ensure the course exists and belongs to the teacher
  const course = await prisma.course.findUnique({
    where: { courseId },
    include: { teacher: true }, // Include the teacher to check ownership
  });
  appAssert(course, NOT_FOUND, "Course not found");
  appAssert(
    course.teacher.userId === teacherId,
    UNAUTHORIZED,
    "Unauthorized to approve enrollments for this course"
  );

  // Ensure the enrollment exists for the student in the course
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_courseId: {
        studentId,
        courseId,
      },
    },
  });
  appAssert(enrollment, NOT_FOUND, "Enrollment not found");

  // Update the enrollment status to APPROVED
  const updatedEnrollment = await prisma.enrollment.update({
    where: {
      studentId_courseId: {
        studentId,
        courseId,
      },
    },
    data: {
      status: "APPROVED",
    },
  });

  console.log(`Enrollment approved successfully:`, updatedEnrollment);

  return res.status(OK).json(updatedEnrollment);
});
