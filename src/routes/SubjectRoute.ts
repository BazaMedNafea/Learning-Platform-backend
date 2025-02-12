// SubjectRoute.ts
import express from "express";
import {
  addSubjectHandler,
  getSubjectsByLevelHandler,
  getSubjectsByStreamHandler,
  deleteSubjectHandler,
} from "../controllers/SubjectController";
import authenticate from "../middleware/authenticate";
import isAdmin from "../middleware/isAdmin";

const SubjectRoutes = express.Router();

// Admin-only routes
SubjectRoutes.post("/", authenticate, isAdmin, addSubjectHandler);
SubjectRoutes.delete(
  "/:subjectId",
  authenticate,
  isAdmin,
  deleteSubjectHandler
);

// Public routes
SubjectRoutes.get("/level/:level", getSubjectsByLevelHandler);
SubjectRoutes.get("/stream/:stream", getSubjectsByStreamHandler);

export default SubjectRoutes;
