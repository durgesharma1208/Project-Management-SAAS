import { z } from 'zod';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { createError } from '../middleware/errorHandler.js';

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  jobTitle: z.string().max(100).optional(),
  timezone: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const getProfile = async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};

export const updateProfile = async (req, res, next) => {
  try {
    const updates = updateProfileSchema.parse(req.body);
    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true, runValidators: true });
    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await User.findById(req.userId).select('+password');
    if (!user) throw createError('User not found', 404);

    const valid = await user.comparePassword(currentPassword);
    if (!valid) throw createError('Current password is incorrect', 400);

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

export default { getProfile, updateProfile, changePassword };
