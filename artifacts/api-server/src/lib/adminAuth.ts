import { randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const SESSION_DAYS = 7;
const COOKIE_NAME = "nico_admin_session";

type SessionPayload = {
  email: string;
  expiresAt: number;
  nonce: string;
};

export function configuredAdminEmail(): string | null {
  const email = process.env["ADMIN_EMAIL"]?.trim().toLowerCase();
  if (!email || !process.env["ADMIN_PASSWORD_HASH"] || !process.env["SESSION_SECRET"]) {
    return null;
  }
  return email;
}

export function setAdminSession(res: Response, email: string): void {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload: SessionPayload = {
    email,
    expiresAt,
    nonce: randomBytes(18).toString("base64url"),
  };
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  res.cookie(COOKIE_NAME, value, {
    signed: true,
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/api",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearAdminSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/api",
  });
}

export function getAdminEmail(req: Request): string | null {
  const configuredEmail = configuredAdminEmail();
  const encoded = req.signedCookies?.[COOKIE_NAME];
  if (!configuredEmail || typeof encoded !== "string") return null;
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    if (
      payload.email?.toLowerCase() !== configuredEmail ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now() ||
      typeof payload.nonce !== "string"
    ) {
      return null;
    }
    return configuredEmail;
  } catch {
    return null;
  }
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!getAdminEmail(req)) {
    res.status(401).json({ error: "Iniciá sesión para continuar." });
    return;
  }
  next();
}
