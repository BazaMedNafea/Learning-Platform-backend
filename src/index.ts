// index.ts

import express from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import "dotenv/config";
import { APP_ORIGIN, NODE_ENV, PORT } from "./constants/env";
import { checkDatabaseConnection } from "./config/db";
import cookieParser from "cookie-parser";
import errorHandler from "./middleware/errorHandler";
import { OK } from "./constants/http";
import AuthRoutes from "./routes/AuthRoute";
import sessionRoutes from "./routes/SessionRoute";
import authenticate from "./middleware/authenticate";
import UserRoutes from "./routes/UserRoute";
import TeacherRoutes from "./routes/TeacherRoute";
import ParentRoutes from "./routes/ParentRoute";
import StudentRoutes from "./routes/StudentRoute"; // Add this line
import SubjectRoutes from "./routes/SubjectRoute";
import CourseRoutes from "./routes/CourseRoute";

const app = express();
const prisma = new PrismaClient();

// Add middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const allowedOrigins = APP_ORIGIN.split(",");
console.log("Allowed Origins:", allowedOrigins); // Log allowed origins for debugging

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true); // Allow requests from the specified origins
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.options("*", cors()); // Enable preflight requests for all routes

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  next();
});

app.use(cookieParser());

// Health check endpoint
app.get("/", (req, res, next) => {
  res.status(OK).json({
    status: "health OK!",
  });
});

// Protected routes
app.use("/sessions", authenticate, sessionRoutes);

// Auth routes
app.use("/auth", AuthRoutes);

// Public routes
app.use("/user", UserRoutes);

// Teacher routes
app.use("/teacher", TeacherRoutes);

// Parent routes
app.use("/parent", ParentRoutes);

// Student routes
app.use("/student", StudentRoutes); // Add this line

// Subjet routes
app.use("/subject", SubjectRoutes);

// Courses routes
app.use("/course", CourseRoutes);

// Error handler
app.use(errorHandler);

// Start the server
app.listen(PORT, async () => {
  console.log(`Server started on http://localhost:${PORT}`);
  // Check the database connection at startup
  await checkDatabaseConnection();
});

export default app;
