// CourseController.ts
import { PrismaClient } from "@prisma/client";
import {
  OK,
  CREATED,
  BAD_REQUEST,
  NOT_FOUND,
  UNAUTHORIZED,
} from "../constants/http";
import fs from "fs";
import appAssert from "../utils/appAssert";
import catchErrors from "../utils/catchErrors";

const prisma = new PrismaClient();

// Create a new course
export const createCourseHandler = catchErrors(async (req, res) => {
  const { title, description, isPublic, subjectId } = req.body;
  const teacherId = req.userId;

  console.log(`Creating course with teacherId: ${teacherId}`);

  // Validate input
  appAssert(title, BAD_REQUEST, "Missing required fields");

  // Ensure the teacher exists
  const teacher = await prisma.teacher.findUnique({
    where: { userId: teacherId },
  });
  if (!teacher) {
    console.error(`Teacher with userId ${teacherId} not found`);
    return res.status(NOT_FOUND).json({ error: "Teacher not found" });
  }

  console.log(`Teacher found: ${JSON.stringify(teacher)}`);

  // Handle image upload
  const image = req.file;
  if (!image) {
    return res.status(BAD_REQUEST).json({ error: "No image uploaded" });
  }

  // Read the image file and encode it as Base64
  const imageBuffer = fs.readFileSync(image.path);
  const imageBase64 = imageBuffer.toString("base64");

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
        image: imageBase64, // Store the Base64-encoded image string
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
  const { courseId, title } = req.body;
  const teacherId = req.userId;

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
  const { topicId, type, data } = req.body;
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
  const { title, description, isPublic, subjectId } = req.body;

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

  // Handle image upload if provided
  let imageBase64 = course.image; // Default to the existing image
  if (req.file) {
    // Read the image file and encode it as Base64
    const imageBuffer = fs.readFileSync(req.file.path);
    imageBase64 = imageBuffer.toString("base64");
  }

  // Update the course
  const updatedCourse = await prisma.course.update({
    where: { courseId },
    data: {
      title,
      description,
      isPublic: isPublicBoolean, // Use the parsed boolean value
      subjectId,
      image: imageBase64, // Update the image field
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
          contents: false,
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
