import { z } from 'zod';
import Team from '../models/Team.js';
import Membership from '../models/Membership.js';
import { createError } from '../middleware/errorHandler.js';

const teamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().optional(),
  emoji: z.string().optional(),
});

// ── List teams ─────────────────────────────────────────────────────────────────
export const getTeams = async (req, res, next) => {
  try {
    const teams = await Team.find({ workspace: req.params.workspaceId, isActive: true })
      .populate('members.user', 'name email avatar')
      .populate('createdBy', 'name')
      .lean();
    res.json({ success: true, data: { teams } });
  } catch (err) {
    next(err);
  }
};

// ── Get single team ────────────────────────────────────────────────────────────
export const getTeam = async (req, res, next) => {
  try {
    const team = await Team.findOne({ _id: req.params.teamId, workspace: req.params.workspaceId, isActive: true })
      .populate('members.user', 'name email avatar jobTitle')
      .populate('createdBy', 'name');
    if (!team) throw createError('Team not found', 404);
    res.json({ success: true, data: { team } });
  } catch (err) {
    next(err);
  }
};

// ── Create team ────────────────────────────────────────────────────────────────
export const createTeam = async (req, res, next) => {
  try {
    const data = teamSchema.parse(req.body);
    const team = await Team.create({
      ...data,
      workspace: req.params.workspaceId,
      createdBy: req.userId,
      members: [{ user: req.userId, role: 'lead' }],
    });
    await team.populate('members.user', 'name email avatar');
    res.status(201).json({ success: true, data: { team } });
  } catch (err) {
    next(err);
  }
};

// ── Update team ────────────────────────────────────────────────────────────────
export const updateTeam = async (req, res, next) => {
  try {
    const updates = teamSchema.partial().parse(req.body);
    const team = await Team.findOneAndUpdate(
      { _id: req.params.teamId, workspace: req.params.workspaceId },
      updates,
      { new: true }
    ).populate('members.user', 'name email avatar');
    if (!team) throw createError('Team not found', 404);
    res.json({ success: true, data: { team } });
  } catch (err) {
    next(err);
  }
};

// ── Delete team ────────────────────────────────────────────────────────────────
export const deleteTeam = async (req, res, next) => {
  try {
    await Team.findOneAndUpdate(
      { _id: req.params.teamId, workspace: req.params.workspaceId },
      { isActive: false }
    );
    res.json({ success: true, message: 'Team deleted' });
  } catch (err) {
    next(err);
  }
};

// ── Add member to team ─────────────────────────────────────────────────────────
export const addTeamMember = async (req, res, next) => {
  try {
    const { userId, role = 'member' } = z.object({
      userId: z.string(),
      role: z.enum(['lead', 'member']).optional(),
    }).parse(req.body);

    // Must be a workspace member
    const isMember = await Membership.findOne({ workspace: req.params.workspaceId, user: userId });
    if (!isMember) throw createError('User is not a workspace member', 400);

    const team = await Team.findOne({ _id: req.params.teamId, workspace: req.params.workspaceId });
    if (!team) throw createError('Team not found', 404);

    const already = team.members.find((m) => m.user.toString() === userId);
    if (already) throw createError('User is already a team member', 409);

    team.members.push({ user: userId, role });
    await team.save();
    await team.populate('members.user', 'name email avatar');
    res.json({ success: true, data: { team } });
  } catch (err) {
    next(err);
  }
};

// ── Remove member from team ────────────────────────────────────────────────────
export const removeTeamMember = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const team = await Team.findOne({ _id: req.params.teamId, workspace: req.params.workspaceId });
    if (!team) throw createError('Team not found', 404);

    team.members = team.members.filter((m) => m._id.toString() !== memberId);
    await team.save();
    await team.populate('members.user', 'name email avatar');
    res.json({ success: true, data: { team } });
  } catch (err) {
    next(err);
  }
};

export default { getTeams, getTeam, createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember };
