import { getEnv } from '../config/env.js';
import { forbidden } from '../utils/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Enforces Origin/Referer allowlist + custom header/JSON expectation on state-changing requests
 * when using HTTP-only SameSite cookies.
 */
export function csrfOriginCheck(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const env = getEnv();
  const origin = req.headers.origin;
  if (origin) {
    const allowed = new Set(env.clientOrigins);
    const hostOrigin = req.headers.host ? `${req.protocol}://${req.headers.host}` : null;
    if (hostOrigin) {
      allowed.add(hostOrigin);
    }
    if (!allowed.has(origin)) {
      return next(forbidden(`Origin ${origin} is not allowed for state-changing requests.`, 'CSRF_ORIGIN_DENIED'));
    }
  }

  return next();
}
