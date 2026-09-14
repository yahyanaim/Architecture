import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { IS_PROD } from '../../config/index';

export const CSRF_COOKIE_NAME = 'csrf_token';
export const XSRF_COOKIE_NAME = 'XSRF-TOKEN';

export const CSRF_COOKIE_OPTIONS = {
  httpOnly: false, // Must be readable by client JavaScript for double-submit
  secure: IS_PROD,
  sameSite: 'lax' as const,
  path: '/',
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF Protection Middleware.
 *
 * 1. Automatically provisions a crypto-random CSRF token cookie on requests
 *    (both `csrf_token` and `XSRF-TOKEN` for Axios compatibility) if not present.
 * 2. For mutating requests (POST, PUT, PATCH, DELETE) that authenticate via
 *    session cookies (`access`, `token`, `refresh`), validates that the request
 *    submits a matching token in the `x-csrf-token` / `x-xsrf-token` header.
 * 3. Machine requests authenticated via `Authorization: Bearer` or raw webhooks
 *    are immune to cross-site request forgery because browsers never attach
 *    custom Authorization headers cross-origin.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // 1. Ensure client has a CSRF cookie
  let token = req.cookies?.[CSRF_COOKIE_NAME] || req.cookies?.[XSRF_COOKIE_NAME];
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE_NAME, token, CSRF_COOKIE_OPTIONS);
    res.cookie(XSRF_COOKIE_NAME, token, CSRF_COOKIE_OPTIONS);
  }
  res.locals.csrfToken = token;

  // 2. Safe HTTP methods skip mutation checks
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // 3. Exclude raw webhook endpoints (they verify signatures via HMAC, not session cookies)
  if (req.originalUrl?.includes('/billing/webhook') || req.path?.includes('/billing/webhook')) {
    return next();
  }

  // 4. Check if request is authenticated using browser session cookies without an explicit Bearer header
  const hasCookieSession = Boolean(
    (req.cookies?.access || req.cookies?.token || req.cookies?.refresh) &&
    !req.headers.authorization?.startsWith('Bearer ')
  );

  if (hasCookieSession) {
    const headerToken =
      req.headers['x-csrf-token'] ||
      req.headers['x-xsrf-token'] ||
      req.headers['csrf-token'];

    if (!headerToken || headerToken !== token) {
      res.status(403).json({
        code: 'CSRF_INVALID',
        message: 'CSRF token missing or invalid',
      });
      return;
    }
  }

  next();
}
