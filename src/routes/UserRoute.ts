import express from "express";
import {
  getUserInfoHandler,
  updateUserInfoHandler,
  getUserPublicInfoHandler,
} from "../controllers/UserController";
import authenticate from "../middleware/authenticate";

const UserRoutes = express.Router();

// prefix: /user

// Public routes
UserRoutes.get("/:userId", getUserPublicInfoHandler); // Get public user information by ID

// Authenticated routes (prefixed with /my/)
UserRoutes.get("/my/info", authenticate, getUserInfoHandler); // Get authenticated user's info
UserRoutes.put("/my/update", authenticate, updateUserInfoHandler); // Update authenticated user's info

export default UserRoutes;
