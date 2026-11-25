import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';
import { User } from '../models/User.js';
import { forbidden, unauthorized } from '../utils/errors.js';

export function signSessionToken(user) {
  const env = getEnv();
  return jwt.sign(
    {
      sub: String(user._id),
      userId: user.userId,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export function setAuthCookie(res, token) {
  const env = getEnv();
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res) {
  const env = getEnv();
  res.clearCookie(env.cookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    path: '/',
  });
}

export async function requireAuth(req, _res, next) {
  try {
    const env = getEnv();
    const cookieToken = req.cookies?.[env.cookieName];
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const token = cookieToken || bearerToken;

    if (!token) {
      return next(unauthorized('Authentication session missing or expired.'));
    }

    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      return next(unauthorized('Invalid or expired authentication session.'));
    }

    const user = await User.findById(payload.sub).populate('assignedHostelId', 'hostelId hostelName');
    if (!user) {
      return next(unauthorized('User account no longer exists.'));
    }

    if (user.accountStatus !== 'Active') {
      return next(forbidden(`Account is ${user.accountStatus}. Access denied.`, 'ACCOUNT_INACTIVE'));
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireRoles(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        forbidden(`Role ${req.user.role} does not have permission for this operation.`)
      );
    }
    return next();
  };
}
