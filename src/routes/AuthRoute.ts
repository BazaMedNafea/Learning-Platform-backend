import { Router } from "express";
import {
  loginHandler,
  logoutHandler,
  refreshHandler,
  registerHandler,
} from "../controllers/AuthController";

const AuthRoutes = Router();

// prefix: /auth
AuthRoutes.post("/register", registerHandler);
AuthRoutes.post("/login", loginHandler);
AuthRoutes.get("/refresh", refreshHandler);
AuthRoutes.get("/logout", logoutHandler);

export default AuthRoutes;
