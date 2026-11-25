import express from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';
import { User } from '../models/User.js';
import { authController } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/errorHandler.js';
import { loginSchema, registerSchema, updateProfileSchema } from '../validators/schemas.js';

export function createAuthRouter({ loginRateLimitMax = 30 } = {}) {
  const router = express.Router();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: loginRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      code: 'RATE_LIMITED',
      message: 'Too many login attempts. Please wait before trying again.',
      fieldErrors: null,
    },
  });

  router.get('/session', async (req, res) => {
    const env = getEnv();
    const token = req.cookies?.[env.cookieName];
    if (!token) {
      return res.json({ authenticated: false, user: null });
    }
    try {
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(payload.sub).populate('assignedHostelId', 'hostelId hostelName');
      if (!user || user.accountStatus !== 'Active') {
        return res.json({ authenticated: false, user: null });
      }
      return res.json({ authenticated: true, user: user.toJSON() });
    } catch {
      return res.json({ authenticated: false, user: null });
    }
  });

  router.post('/login', loginLimiter, validateBody(loginSchema), authController.login);
  router.post('/register', loginLimiter, validateBody(registerSchema), authController.register);
  router.post('/logout', requireAuth, authController.logout);
  router.get('/me', requireAuth, authController.me);
  router.patch('/profile', requireAuth, validateBody(updateProfileSchema), authController.updateProfile);

  return router;
}
