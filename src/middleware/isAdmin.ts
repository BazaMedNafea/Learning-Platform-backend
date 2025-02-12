import { RequestHandler } from "express";
import appAssert from "../utils/appAssert";
import { FORBIDDEN } from "../constants/http";
import AppErrorCode from "../constants/appErrorCode";

const isAdmin: RequestHandler = (req, res, next) => {
  appAssert(
    req.role === "ADMIN",
    FORBIDDEN,
    "Access denied",
    AppErrorCode.InvalidRole
  );
  next();
};

export default isAdmin;
