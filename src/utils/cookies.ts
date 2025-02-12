import { CookieOptions, Response } from "express";
import { fifteenMinutesFromNow, thirtyDaysFromNow } from "./date";
import { NODE_ENV } from "../constants/env";

export const REFRESH_PATH = "/auth/refresh";

// Determine cookie options based on environment
const getCookieDefaults = (): CookieOptions => {
  if (NODE_ENV === "development") {
    return {
      sameSite: "lax", // Less strict for local development
      httpOnly: true,
      secure: false, // Allow insecure cookies in development
    };
  }

  return {
    sameSite: "none", // Cross-site for production
    httpOnly: true,
    secure: true, // Require secure connection in production
  };
};

export const getAccessTokenCookieOptions = (): CookieOptions => ({
  ...getCookieDefaults(),
  expires: fifteenMinutesFromNow(),
});

export const getRefreshTokenCookieOptions = (): CookieOptions => ({
  ...getCookieDefaults(),
  expires: thirtyDaysFromNow(),
  path: REFRESH_PATH,
});

type Params = {
  res: Response;
  accessToken: string;
  refreshToken: string;
};
export const setAuthCookies = ({ res, accessToken, refreshToken }: Params) =>
  res
    .cookie("accessToken", accessToken, getAccessTokenCookieOptions())
    .cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());

export const clearAuthCookies = (res: Response) => {
  const defaults = getCookieDefaults();
  return res.clearCookie("accessToken", defaults).clearCookie("refreshToken", {
    ...defaults,
    path: REFRESH_PATH,
  });
};
