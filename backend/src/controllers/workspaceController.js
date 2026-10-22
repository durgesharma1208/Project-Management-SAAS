import { z } from 'zod';
import crypto from 'crypto';
import Workspace from '../models/Workspace.js';
import Membership from '../models/Membership.js';
import Invitation from '../models/Invitation.js';
import User from '../models/User.js';
import Activity from '../models/Activity.js';
import { sendEmail } from '../config/email.js';
import { createError } from '../middleware/errorHandler.js';

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().optional(),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z.string().optional(),
  settings: z.object({
    allowMemberInvite: z.boolean().optional(),
    defaultRole: z.enum(['member', 'admin']).optional(),
  }).optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
});

// ── Create workspace ───────────────────────────────────────────────────────────
export const createWorkspace = async (req, res, next) => {
  try {
    const { name, description, color } = createWorkspaceSchema.parse(req.body);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
    const workspace = await Workspace.create({ name, slug, description, color, owner: req.userId });
    await Membership.create({ workspace: workspace._id, user: req.userId, role: 'owner' });
    res.status(201).json({ success: true, data: { workspace } });
  } catch (err) {
    next(err);
  }
};

// ── Get my workspaces ──────────────────────────────────────────────────────────
export const getMyWorkspaces = async (req, res, next) => {
  try {
    const memberships = await Membership.find({ user: req.userId }).populate('workspace');
    const workspaces = memberships
      .filter((m) => m.workspace?.isActive)
      .map((m) => ({ ...m.workspace.toJSON(), role: m.role }));
    res.json({ success: true, data: { workspaces } });
  } catch (err) {
    next(err);
  }
};

// ── Get single workspace ───────────────────────────────────────────────────────
export const getWorkspace = async (req, res, next) => {
  try {
    // requireWorkspaceMember already attached req.workspace
    res.json({ success: true, data: { workspace: req.workspace, role: req.membership.role } });
  } catch (err) {
    next(err);
  }
};

// ── Update workspace ───────────────────────────────────────────────────────────
export const updateWorkspace = async (req, res, next) => {
  try {
    const updates = updateWorkspaceSchema.parse(req.body);
    const workspace = await Workspace.findByIdAndUpdate(req.params.workspaceId, updates, { new: true });
    res.json({ success: true, data: { workspace } });
  } catch (err) {
    next(err);
  }
};

// ── Get members ────────────────────────────────────────────────────────────────
export const getMembers = async (req, res, next) => {
  try {
    const members = await Membership.find({ workspace: req.params.workspaceId })
      .populate('user', 'name email avatar jobTitle')
      .lean();
    res.json({ success: true, data: { members } });
  } catch (err) {
    next(err);
  }
};

// ── Update member role ─────────────────────────────────────────────────────────
export const updateMemberRole = async (req, res, next) => {
  try {
    const { role } = z.object({ role: z.enum(['admin', 'member']) }).parse(req.body);
    const { memberId } = req.params;

    const target = await Membership.findOne({ workspace: req.params.workspaceId, _id: memberId });
    if (!target) throw createError('Member not found', 404);
    if (target.role === 'owner') throw createError('Cannot change owner role', 400);

    target.role = role;
    await target.save();
    res.json({ success: true, data: { membership: target } });
  } catch (err) {
    next(err);
  }
};

// ── Remove member ──────────────────────────────────────────────────────────────
export const removeMember = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const target = await Membership.findOne({ workspace: req.params.workspaceId, _id: memberId });
    if (!target) throw createError('Member not found', 404);
    if (target.role === 'owner') throw createError('Cannot remove workspace owner', 400);
    await target.deleteOne();
    res.json({ success: true, message: 'Member removed' });
  } catch (err) {
    next(err);
  }
};

// ── Invite member ──────────────────────────────────────────────────────────────
export const inviteMember = async (req, res, next) => {
  try {
    const { email, role } = inviteSchema.parse(req.body);
    const { workspaceId } = req.params;

    // Check if already a member
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const existing = await Membership.findOne({ workspace: workspaceId, user: existingUser._id });
      if (existing) throw createError('User is already a member of this workspace', 409);
    }

    // Revoke any pending invitation for same email
    await Invitation.updateMany(
      { workspace: workspaceId, email, status: 'pending' },
      { status: 'revoked' }
    );

    const rawToken = crypto.randomBytes(32).toString('hex');
    const invitation = await Invitation.create({
      workspace: workspaceId,
      email,
      role,
      token: rawToken,
      invitedBy: req.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    const inviteUrl = `${process.env.CLIENT_URL}/invite/${rawToken}`;
    await sendEmail({
      to: email,
      subject: `You've been invited to ${req.workspace.name} on TaskFlow`,
      html: `<p>${req.user.name} invited you to join <b>${req.workspace.name}</b>.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>${inviteUrl}</p>`,
      text: `Accept your invitation: ${inviteUrl}`,
    });

    res.status(201).json({ success: true, data: { invitation: { ...invitation.toJSON(), inviteUrl } } });
  } catch (err) {
    next(err);
  }
};

// ── Accept invitation ──────────────────────────────────────────────────────────
export const acceptInvitation = async (req, res, next) => {
  try {
    const { token } = req.params;
    const invitation = await Invitation.findOne({ token, status: 'pending' }).populate('workspace');
    if (!invitation) throw createError('Invitation not found or already used', 404);
    if (invitation.expiresAt < new Date()) {
      invitation.status = 'expired';
      await invitation.save();
      throw createError('Invitation has expired', 410);
    }

    // Ensure the logged-in user email matches
    if (req.user.email !== invitation.email) {
      throw createError('This invitation was sent to a different email address', 403);
    }

    // Avoid duplicate membership
    const exists = await Membership.findOne({ workspace: invitation.workspace._id, user: req.userId });
    if (!exists) {
      await Membership.create({ workspace: invitation.workspace._id, user: req.userId, role: invitation.role });
    }

    invitation.status = 'accepted';
    await invitation.save();

    res.json({ success: true, data: { workspace: invitation.workspace } });
  } catch (err) {
    next(err);
  }
};

// ── Get invitation info (public — for the accept page) ──────────────────────
export const getInvitation = async (req, res, next) => {
  try {
    const { token } = req.params;
    const invitation = await Invitation.findOne({ token, status: 'pending' })
      .populate('workspace', 'name color logo')
      .populate('invitedBy', 'name avatar');
    if (!invitation) throw createError('Invitation not found or already used', 404);
    if (invitation.expiresAt < new Date()) throw createError('Invitation has expired', 410);
    res.json({ success: true, data: { invitation } });
  } catch (err) {
    next(err);
  }
};

export default {
  createWorkspace, getMyWorkspaces, getWorkspace, updateWorkspace,
  getMembers, updateMemberRole, removeMember,
  inviteMember, acceptInvitation, getInvitation,
};
