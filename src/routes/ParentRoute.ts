import express from "express";
import {
  getParentsHandler,
  getParentByIdHandler,
  addParentHandler,
  editParentHandler,
  deleteParentHandler,
  unenrollStudentFromCourseHandler,
  enrollStudentToCourseHandler,
  getParentStudentsHandler,
} from "../controllers/ParentController";
import authenticate from "../middleware/authenticate";
import isAdmin from "../middleware/isAdmin";

const ParentRoutes = express.Router();

// Admin-only routes
ParentRoutes.get("/", authenticate, isAdmin, getParentsHandler); // Get all parents
ParentRoutes.get("/:parentId", authenticate, isAdmin, getParentByIdHandler); // Get a parent by ID
ParentRoutes.post("/add", addParentHandler); // Add a parent manually
ParentRoutes.put("/:parentId", authenticate, isAdmin, editParentHandler); // Edit a parent
ParentRoutes.delete("/:parentId", authenticate, isAdmin, deleteParentHandler); // Delete a parent

// Parent routes
ParentRoutes.post("/enroll", enrollStudentToCourseHandler); // Enroll a student to a course
ParentRoutes.post("/unenroll", authenticate, unenrollStudentFromCourseHandler); // Unenroll a student from a course
ParentRoutes.get("/:parentId/students", authenticate, getParentStudentsHandler); // Get students of a parent

export default ParentRoutes;
