import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "./authMiddleware";

interface RateBucket {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  name: string;
  windowMs: number;
  maxRequests: number;
  message: string;
  keyGenerator?: (req: AuthenticatedRequest) => string;
}

export function extractClientIp(req: AuthenticatedRequest): string {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  return String(ip).replace(/^::ffff:/, "");
}

/**
 * Lightweight in-memory fixed-window rate limiter keyed per IP, user, or target field.
 * Sets standard `Retry-After` and `X-RateLimit-*` response headers and returns HTTP 429 on excess.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const buckets = new Map<string, RateBucket>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const now = Date.now();

    // Opportunistic cleanup to keep memory bounded on long-lived instances
    if (buckets.size > 2000) {
      for (const [k, entry] of buckets.entries()) {
        if (now >= entry.resetAt) {
          buckets.delete(k);
        }
      }
    }

    const clientIp = extractClientIp(req);
    const rawKey = options.keyGenerator ? options.keyGenerator(req) : clientIp;
    const key = `${options.name}:${rawKey}`;

    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, options.maxRequests - bucket.count);
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    res.setHeader("X-RateLimit-Limit", String(options.maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(remaining));

    if (bucket.count > options.maxRequests) {
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        message: options.message,
        retryAfterSeconds: retryAfterSec,
      });
    }

    return next();
  };
}

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

export const assistantMinuteLimiter = createRateLimiter({
  name: "assistant-min",
  windowMs: 60 * 1000,
  maxRequests: Number(process.env.RATE_LIMIT_ASSISTANT_PER_MIN || 12),
  keyGenerator: (req) => `${extractClientIp(req)}:u:${req.authUserId || "anon"}`,
  message:
    "Muitas perguntas em seguida. Aguarde cerca de 1 minuto antes de enviar uma nova dúvida ao Assistente CuiDA.",
});

export const assistantHourlyLimiter = createRateLimiter({
  name: "assistant-hour",
  windowMs: 60 * 60 * 1000,
  maxRequests: Number(process.env.RATE_LIMIT_ASSISTANT_PER_HOUR || 60),
  keyGenerator: (req) => `${extractClientIp(req)}:u:${req.authUserId || "anon"}`,
  message:
    "Você atingiu o limite temporário de consultas por hora no Assistente CuiDA. Tente novamente mais tarde.",
});

export const emailRecoveryIpLimiter = createRateLimiter({
  name: "recover-email-ip",
  windowMs: FIFTEEN_MIN_MS,
  maxRequests: Number(process.env.RATE_LIMIT_EMAIL_PER_15M || 10),
  keyGenerator: (req) => extractClientIp(req),
  message:
    "Muitas solicitações de envio de e-mail em pouco tempo. Aguarde 15 minutos antes de tentar novamente.",
});

export const emailRecoveryTargetLimiter = createRateLimiter({
  name: "recover-email-target",
  windowMs: FIFTEEN_MIN_MS,
  maxRequests: Number(process.env.RATE_LIMIT_EMAIL_PER_15M || 10),
  keyGenerator: (req) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    return email || extractClientIp(req);
  },
  message:
    "Muitos pedidos de código para este mesmo e-mail. Aguarde 15 minutos antes de solicitar outro.",
});

export const recoveryConfirmLimiter = createRateLimiter({
  name: "recover-confirm",
  windowMs: FIFTEEN_MIN_MS,
  maxRequests: 15,
  keyGenerator: (req) => extractClientIp(req),
  message:
    "Muitas tentativas de confirmação de código. Aguarde 15 minutos antes de tentar novamente.",
});

export const authAttemptLimiter = createRateLimiter({
  name: "auth-attempt",
  windowMs: FIFTEEN_MIN_MS,
  maxRequests: 25,
  keyGenerator: (req) => extractClientIp(req),
  message:
    "Muitas tentativas de acesso ou cadastro seguidas. Aguarde alguns minutos e tente novamente.",
});

export const forumPostLimiter = createRateLimiter({
  name: "forum-post",
  windowMs: 60 * 1000,
  maxRequests: Number(process.env.RATE_LIMIT_FORUM_PER_MIN || 15),
  keyGenerator: (req) => `${extractClientIp(req)}:u:${req.authUserId || "anon"}`,
  message:
    "Você enviou muitas mensagens em pouco tempo no fórum. Aguarde um minuto antes de publicar novamente.",
});
