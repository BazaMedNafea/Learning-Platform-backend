// middleware/isTeacher.ts
import { RequestHandler } from "express";
import appAssert from "../utils/appAssert";
import { FORBIDDEN } from "../constants/http";
import AppErrorCode from "../constants/appErrorCode";

const isTeacher: RequestHandler = (req, res, next) => {
  appAssert(
    req.role === "TEACHER",
    FORBIDDEN,
    "Access denied",
    AppErrorCode.InvalidRole
  );
  next();
};

export default isTeacher;
