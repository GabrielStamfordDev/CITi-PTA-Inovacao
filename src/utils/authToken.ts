import crypto from "crypto";

export const AUTH_COOKIE_NAME = "cuida_token";
export const AUTH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export interface AuthTokenPayload {
  sub: number;
  email: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLen), "base64");
}

function getSigningSecret(): string {
  const explicit = process.env.AUTH_SECRET?.trim() || process.env.JWT_SECRET?.trim();
  if (explicit) return explicit;

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET deve estar definida no ambiente de produção.");
  }

  // Fallback determinístico em desenvolvimento para preservar sessões durante hot-reloads
  return crypto
    .createHmac("sha256", "cuida-dev-session-fallback")
    .update(process.env.DATABASE_URL || "cuida-local")
    .digest("hex");
}

export function signAuthToken(userId: number, email: string): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + Math.floor(AUTH_TOKEN_TTL_MS / 1000);

  const headerPart = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadPart = base64UrlEncode(
    JSON.stringify({ sub: userId, email, iat: nowSec, exp: expSec })
  );

  const data = `${headerPart}.${payloadPart}`;
  const signature = crypto
    .createHmac("sha256", getSigningSecret())
    .update(data)
    .digest();

  return `${data}.${base64UrlEncode(signature)}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const parts = String(token || "").trim().split(".");
    if (parts.length !== 3) return null;

    const [headerPart, payloadPart, sigPart] = parts;
    const data = `${headerPart}.${payloadPart}`;

    const expectedSig = crypto
      .createHmac("sha256", getSigningSecret())
      .update(data)
      .digest();
    const providedSig = base64UrlDecode(sigPart);

    if (
      providedSig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(providedSig, expectedSig)
    ) {
      return null;
    }

    const header = JSON.parse(base64UrlDecode(headerPart).toString("utf8"));
    if (header?.alg !== "HS256") return null;

    const payload = JSON.parse(base64UrlDecode(payloadPart).toString("utf8"));
    const nowSec = Math.floor(Date.now() / 1000);

    if (
      typeof payload?.sub !== "number" ||
      !Number.isInteger(payload.sub) ||
      payload.sub <= 0 ||
      typeof payload?.exp !== "number" ||
      payload.exp <= nowSec
    ) {
      return null;
    }

    return payload as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function parseCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(";");

  for (const pair of pairs) {
    const eqIndex = pair.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = pair.slice(0, eqIndex).trim();
    if (key === name) {
      return decodeURIComponent(pair.slice(eqIndex + 1).trim());
    }
  }

  return null;
}
