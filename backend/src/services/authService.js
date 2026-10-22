import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import Membership from '../models/Membership.js';
import { sendEmail } from '../config/email.js';
import { createError } from '../middleware/errorHandler.js';

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
};

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth',
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', { path: '/api/auth' });
};

// ── Register ───────────────────────────────────────────────────────────────────
export const register = async ({ name, email, password }) => {
  const existing = await User.findOne({ email });
  if (existing) throw createError('Email already in use', 409);

  const user = await User.create({ name, email, password });

  // Create default personal workspace
  const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36);
  const workspace = await Workspace.create({ name: `${name}'s Workspace`, slug, owner: user._id });
  await Membership.create({ workspace: workspace._id, user: user._id, role: 'owner' });

  const { accessToken, refreshToken } = generateTokens(user._id);

  // Store hashed refresh token
  const hashed = await bcrypt.hash(refreshToken, 10);
  await User.findByIdAndUpdate(user._id, { $push: { refreshTokens: hashed } });

  return { user, accessToken, refreshToken, workspace };
};

// ── Login ──────────────────────────────────────────────────────────────────────
export const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password +refreshTokens');
  if (!user || !user.isActive) throw createError('Invalid credentials', 401);

  const valid = await user.comparePassword(password);
  if (!valid) throw createError('Invalid credentials', 401);

  const { accessToken, refreshToken } = generateTokens(user._id);

  // Limit stored refresh tokens to 5 (oldest pruned)
  const tokens = user.refreshTokens || [];
  const hashed = await bcrypt.hash(refreshToken, 10);
  const kept = tokens.slice(-4);
  kept.push(hashed);
  await User.findByIdAndUpdate(user._id, { $set: { refreshTokens: kept } });

  return { user, accessToken, refreshToken };
};

// ── Refresh ────────────────────────────────────────────────────────────────────
export const refresh = async (incomingToken) => {
  if (!incomingToken) throw createError('No refresh token provided', 401);

  let decoded;
  try {
    decoded = jwt.verify(incomingToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw createError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(decoded.userId).select('+refreshTokens');
  if (!user || !user.isActive) throw createError('User not found', 401);

  // Verify the token matches one stored
  const tokens = user.refreshTokens || [];
  let matchIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (await bcrypt.compare(incomingToken, tokens[i])) {
      matchIndex = i;
      break;
    }
  }
  if (matchIndex === -1) throw createError('Refresh token not recognised', 401);

  // Rotate: remove old, add new
  const { accessToken, refreshToken: newRefresh } = generateTokens(user._id);
  const newHashed = await bcrypt.hash(newRefresh, 10);
  tokens.splice(matchIndex, 1, newHashed);
  await User.findByIdAndUpdate(user._id, { $set: { refreshTokens: tokens } });

  return { accessToken, refreshToken: newRefresh };
};

// ── Logout ─────────────────────────────────────────────────────────────────────
export const logout = async (userId, incomingToken) => {
  if (!incomingToken) return;
  const user = await User.findById(userId).select('+refreshTokens');
  if (!user) return;
  const tokens = user.refreshTokens || [];
  const remaining = [];
  for (const t of tokens) {
    const matches = await bcrypt.compare(incomingToken, t);
    if (!matches) remaining.push(t);
  }
  await User.findByIdAndUpdate(userId, { $set: { refreshTokens: remaining } });
};

// ── Forgot password ────────────────────────────────────────────────────────────
export const forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  if (!user) return; // silently do nothing to avoid enumeration

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await User.findByIdAndUpdate(user._id, {
    passwordResetToken: hashed,
    passwordResetExpires: expires,
  });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;
  await sendEmail({
    to: email,
    subject: 'Reset your TaskFlow password',
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p><p>${resetUrl}</p>`,
    text: `Reset your password: ${resetUrl}`,
  });
};

// ── Reset password ─────────────────────────────────────────────────────────────
export const resetPassword = async (rawToken, newPassword) => {
  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+password');

  if (!user) throw createError('Token is invalid or has expired', 400);

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokens = []; // invalidate all sessions
  await user.save();
};

export { generateTokens, setRefreshCookie, clearRefreshCookie };
export default { register, login, refresh, logout, forgotPassword, resetPassword };
