import rateLimit from 'express-rate-limit';
import { RequestHandler } from 'express';

function skipInTest(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') {
      next();
      return;
    }
    handler(req, res, next);
  };
}

export const authRateLimiter = skipInTest(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Try again later.' },
  }),
);

export const incidentRateLimiter = skipInTest(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many incident submissions. Try again shortly.' },
  }),
);
