import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  firstRequestTime: number;
}

const ipRequestMap = new Map<string, RateLimitRecord>();

/**
 * Lightweight in-memory rate limiter for unauthenticated public endpoints.
 * Configurable via process.env.PUBLIC_RATE_LIMIT_WINDOW_MS and PUBLIC_RATE_LIMIT_MAX_REQUESTS.
 */
export function publicRateLimiter(req: Request, res: Response, next: NextFunction) {
  const windowMs = Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 mins default
  const maxRequests = Number(process.env.PUBLIC_RATE_LIMIT_MAX_REQUESTS) || 10; // 10 requests per window

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown_ip';
  const now = Date.now();

  const record = ipRequestMap.get(clientIp);

  if (!record) {
    ipRequestMap.set(clientIp, { count: 1, firstRequestTime: now });
    return next();
  }

  if (now - record.firstRequestTime > windowMs) {
    // Window expired, reset counter
    ipRequestMap.set(clientIp, { count: 1, firstRequestTime: now });
    return next();
  }

  if (record.count >= maxRequests) {
    return res.status(429).json({
      status: 'error',
      statusCode: 429,
      message: 'Too many requests from this IP address. Please try again later.'
    });
  }

  record.count++;
  return next();
}
