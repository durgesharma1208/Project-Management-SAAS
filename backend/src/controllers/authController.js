import { z } from 'zod';
import * as authService from '../services/authService.js';

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export const registerController = async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const { user, accessToken, refreshToken, workspace } = await authService.register(data);
    authService.setRefreshCookie(res, refreshToken);
    res.status(201).json({ success: true, data: { user, accessToken, workspace } });
  } catch (err) {
    next(err);
  }
};

export const loginController = async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.login(data);
    authService.setRefreshCookie(res, refreshToken);
    res.json({ success: true, data: { user, accessToken } });
  } catch (err) {
    next(err);
  }
};

export const refreshController = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    const { accessToken, refreshToken } = await authService.refresh(token);
    authService.setRefreshCookie(res, refreshToken);
    res.json({ success: true, data: { accessToken } });
  } catch (err) {
    next(err);
  }
};

export const logoutController = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    await authService.logout(req.userId, token);
    authService.clearRefreshCookie(res);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

export const forgotPasswordController = async (req, res, next) => {
  try {
    const { email } = forgotSchema.parse(req.body);
    await authService.forgotPassword(email);
    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

export const resetPasswordController = async (req, res, next) => {
  try {
    const { token, password } = resetSchema.parse(req.body);
    await authService.resetPassword(token, password);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
};

export const getMeController = async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};

export default {
  registerController,
  loginController,
  refreshController,
  logoutController,
  forgotPasswordController,
  resetPasswordController,
  getMeController,
};
