import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { env } from '../../config/env';

const keyGenerator = (req: Request): string => req.ip ?? req.socket?.remoteAddress ?? 'unknown';

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: 'Too many requests, please try again later' },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: 'Too many authentication attempts, please try again later' },
});
