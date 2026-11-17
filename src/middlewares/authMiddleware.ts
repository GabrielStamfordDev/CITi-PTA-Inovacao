import { NextFunction, Request, Response } from "express";
import {
  AUTH_COOKIE_NAME,
  parseCookieValue,
  verifyAuthToken,
} from "../utils/authToken";

export interface AuthenticatedRequest extends Request {
  authUserId?: number;
  authEmail?: string;
}

function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }

  return parseCookieValue(req.headers.cookie, AUTH_COOKIE_NAME);
}

/**
 * Popula req.authUserId se existir um token assinado válido, sem bloquear visitantes anônimos.
 */
export const optionalAuth = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  const token = extractTokenFromRequest(req);
  if (token) {
    const payload = verifyAuthToken(token);
    if (payload) {
      req.authUserId = payload.sub;
      req.authEmail = payload.email;
    }
  }
  next();
};

/**
 * Exige sessão autenticada com token criptograficamente assinado válido (HTTP 401 caso contrário).
 */
export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const token = extractTokenFromRequest(req);
  const payload = token ? verifyAuthToken(token) : null;

  if (!payload) {
    return res
      .status(401)
      .json({ message: "Sessão expirada ou não autenticada. Faça login novamente." });
  }

  req.authUserId = payload.sub;
  req.authEmail = payload.email;
  next();
};
