import { authService } from '../services/AuthService.js';
import { clearAuthCookie, setAuthCookie } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authController = {
  login: asyncHandler(async (req, res) => {
    const { user, token } = await authService.login(req.body);
    setAuthCookie(res, token, req);
    res.json({ user });
  }),

  register: asyncHandler(async (req, res) => {
    const { user, token } = await authService.registerStudent(req.body);
    setAuthCookie(res, token, req);
    res.status(201).json({ user });
  }),

  logout: asyncHandler(async (req, res) => {
    await authService.logout(req.user);
    clearAuthCookie(res, req);
    res.json({ ok: true });
  }),

  me: asyncHandler(async (req, res) => {
    const user = await authService.getProfile(req.user._id);
    res.json({ user });
  }),

  updateProfile: asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(req.user._id, req.body);
    res.json({ user });
  }),
};
