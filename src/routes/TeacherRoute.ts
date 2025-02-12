// routes/TeacherRoute.ts
import express from "express";
import {
  getTeacherByIdHandler,
  getAllTeachersHandler,
  addTeacherHandler,
  updateTeacherHandler,
  deleteTeacherHandler,
  getCoursesByTeacherIdHandler,
  getTeacherSubjectsHandler, // Import the new handler
} from "../controllers/TeacherController";
import authenticate from "../middleware/authenticate";
import isAdmin from "../middleware/isAdmin";

const TeacherRoutes = express.Router();

// Authenticated routes
TeacherRoutes.get("/", authenticate, getAllTeachersHandler); // Get all teachers
TeacherRoutes.get("/:teacherId", authenticate, getTeacherByIdHandler); // Get teacher by ID
TeacherRoutes.put("/:teacherId/update", authenticate, updateTeacherHandler); // Update teacher information
TeacherRoutes.get(
  "/:teacherId/courses",
  authenticate,
  getCoursesByTeacherIdHandler
); // Get courses by teacher ID
TeacherRoutes.get(
  "/:teacherId/subjects",
  authenticate,
  getTeacherSubjectsHandler
); // Get subjects by teacher ID

// Admin-only routes
TeacherRoutes.post("/add", authenticate, isAdmin, addTeacherHandler); // Add a teacher manually
TeacherRoutes.delete(
  "/:teacherId",
  authenticate,
  isAdmin,
  deleteTeacherHandler
); // Delete a teacher

export default TeacherRoutes;
