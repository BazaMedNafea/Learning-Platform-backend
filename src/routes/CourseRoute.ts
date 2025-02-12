// CourseRoute.ts
import express from "express";
import {
  createCourseHandler,
  addTopicToCourseHandler,
  addContentToTopicHandler,
  deleteCourseHandler,
  updateCourseHandler,
  updateTopicHandler,
  updateContentHandler,
  getCourseByIdHandler,
  deleteTopicHandler,
  getTopicContentHandler,
  deleteContentHandler,
  getAllCoursesHandler,
  getPublicCoursesHandler,
  getEnrolledStudentsHandler,
  approveEnrollmentHandler,
} from "../controllers/CourseController";
import authenticate from "../middleware/authenticate";
import isTeacher from "../middleware/isTeacher";

const CourseRoutes = express.Router();

// Get all courses and public courses routes
CourseRoutes.get("/all", getAllCoursesHandler);
CourseRoutes.get("/public", getPublicCoursesHandler);

// Get a course by ID (this should come after the specific routes)
CourseRoutes.get("/:courseId", authenticate, getCourseByIdHandler);

// Teacher-only routes
CourseRoutes.post(
  "/create",
  authenticate,
  isTeacher,

  createCourseHandler
);
CourseRoutes.post(
  "/:courseId/addTopic",
  authenticate,
  isTeacher,
  addTopicToCourseHandler
);
CourseRoutes.post(
  "/:topicId/addContent",
  authenticate,
  isTeacher,
  addContentToTopicHandler
);
CourseRoutes.delete("/:courseId", authenticate, isTeacher, deleteCourseHandler);
CourseRoutes.put("/:courseId", authenticate, isTeacher, updateCourseHandler);
CourseRoutes.put(
  "/topic/:topicId",
  authenticate,
  isTeacher,
  updateTopicHandler
);
CourseRoutes.put(
  "/content/:contentId",
  authenticate,
  isTeacher,
  updateContentHandler
);
CourseRoutes.delete(
  "/topic/:topicId",
  authenticate,
  isTeacher,
  deleteTopicHandler
);
CourseRoutes.delete(
  "/content/:contentId",
  authenticate,
  isTeacher,
  deleteContentHandler
);
CourseRoutes.get(
  "/:topicId/content",
  authenticate,
  isTeacher,
  getTopicContentHandler
);

CourseRoutes.get(
  "/:courseId/enrolledStudents",
  authenticate,
  isTeacher,
  getEnrolledStudentsHandler
);

export default CourseRoutes;

CourseRoutes.put(
  "/:courseId/approveEnrollment/:studentId",
  authenticate,
  isTeacher,
  approveEnrollmentHandler
);
