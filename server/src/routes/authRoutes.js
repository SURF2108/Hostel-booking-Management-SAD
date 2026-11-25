import express from 'express';
import rateLimit from 'express-rate-limit';
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

  router.post('/login', loginLimiter, validateBody(loginSchema), authController.login);
  router.post('/register', loginLimiter, validateBody(registerSchema), authController.register);
  router.post('/logout', requireAuth, authController.logout);
  router.get('/me', requireAuth, authController.me);
  router.patch('/profile', requireAuth, validateBody(updateProfileSchema), authController.updateProfile);

  return router;
}
