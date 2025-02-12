// StudentRoute.ts

import express from "express";
import {
  getStudentsHandler,
  getStudentByIdHandler,
  addStudentHandler,
  updateStudentHandler,
  deleteStudentHandler,
  getStudentsByParentIdHandler,
} from "../controllers/StudentController";
import authenticate from "../middleware/authenticate";
import isAdmin from "../middleware/isAdmin";

const StudentRoutes = express.Router();

// Admin-only routes
StudentRoutes.get("/", authenticate, isAdmin, getStudentsHandler); // Get all students
StudentRoutes.get("/:studentId", authenticate, getStudentByIdHandler); // Get a student by ID
StudentRoutes.get(
  "/parent/:parentId",
  authenticate,
  getStudentsByParentIdHandler
); // Get students by parent ID
StudentRoutes.post("/add", authenticate, addStudentHandler); // Add a student manually
StudentRoutes.put("/:studentId", authenticate, updateStudentHandler); // Update a student
StudentRoutes.delete("/:studentId", authenticate, deleteStudentHandler); // Delete a student

export default StudentRoutes;
