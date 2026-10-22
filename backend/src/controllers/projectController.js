import { z } from 'zod';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Activity from '../models/Activity.js';
import Comment from '../models/Comment.js';
import TaskDependency from '../models/TaskDependency.js';
import Membership from '../models/Membership.js';
import { createError } from '../middleware/errorHandler.js';
import { buildPagination, escapeRegex } from '../services/taskQuery.js';

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(['planned', 'active', 'on_hold', 'completed', 'archived']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  color: z.string().max(32).optional(),
  emoji: z.string().max(16).optional(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  team: z.string().optional().nullable(),
  members: z.array(z.string()).optional(),
});

const parseDate = (value, field) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw createError(`${field} is not a valid date`, 422);
  return d;
};

const recordActivity = async (data) => {
  try {
    await Activity.create(data);
  } catch (e) {
    console.error('Activity record failed:', e.message);
  }
};

/** Only workspace members may be added to a project. */
const sanitizeMembers = async (workspaceId, members = []) => {
  if (!members.length) return [];
  const memberships = await Membership.find({ workspace: workspaceId, user: { $in: members } }).select('user');
  return memberships.map((m) => m.user.toString());
};

const withCounts = (project, counts = {}) => {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    ...project.toJSON(),
    taskCounts: counts,
    totalTasks: total,
    completedTasks: counts.done || 0,
    progress: total ? Math.round(((counts.done || 0) / total) * 100) : 0,
  };
};

// ── List projects ──────────────────────────────────────────────────────────────
export const getProjects = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { status, search, archived, limit } = req.query;

    const filter = { workspace: workspaceId, isArchived: archived === 'true' };
    if (status) filter.status = status;
    if (search) filter.name = { $regex: escapeRegex(String(search).trim()), $options: 'i' };

    const { limit: pageLimit } = buildPagination({ limit: limit || 100 }, { defaultLimit: 100, maxLimit: 200 });

    const projects = await Project.find(filter)
      .populate('owner', 'name avatar')
      .populate('members', 'name avatar')
      .sort({ updatedAt: -1 })
      .limit(pageLimit);

    const projectIds = projects.map((p) => p._id);
    const taskCounts = projectIds.length
      ? await Task.aggregate([
        { $match: { project: { $in: projectIds } } },
        { $group: { _id: { project: '$project', status: '$status' }, count: { $sum: 1 } } },
      ])
      : [];

    const countMap = {};
    taskCounts.forEach(({ _id, count }) => {
      const key = _id.project.toString();
      countMap[key] = countMap[key] || {};
      countMap[key][_id.status] = count;
    });

    res.json({
      success: true,
      data: {
        projects: projects.map((p) => withCounts(p, countMap[p._id.toString()] || {})),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── Get single project ─────────────────────────────────────────────────────────
export const getProject = async (req, res, next) => {
  try {
    const { workspaceId, projectId } = req.params;
    const project = await Project.findOne({ _id: projectId, workspace: workspaceId })
      .populate('owner', 'name avatar email')
      .populate('members', 'name avatar email jobTitle')
      .populate('team', 'name color emoji');
    if (!project) throw createError('Project not found', 404);

    const [taskCounts, overdueTasks, assigneeAgg] = await Promise.all([
      Task.aggregate([
        { $match: { project: project._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Task.countDocuments({
        project: project._id,
        status: { $ne: 'done' },
        dueDate: { $lt: new Date() },
      }),
      Task.aggregate([
        { $match: { project: project._id, assignee: { $ne: null } } },
        { $group: { _id: '$assignee', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { count: 1, name: '$user.name', avatar: '$user.avatar' } },
      ]),
    ]);

    const counts = {};
    taskCounts.forEach(({ _id, count }) => { counts[_id] = count; });

    res.json({
      success: true,
      data: {
        project: withCounts(project, counts),
        taskCounts: counts,
        overdueTasks,
        workload: assigneeAgg,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── Create project ─────────────────────────────────────────────────────────────
export const createProject = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const data = projectSchema.parse(req.body);

    const startDate = parseDate(data.startDate, 'startDate');
    const dueDate = parseDate(data.dueDate, 'dueDate');
    if (startDate && dueDate && dueDate < startDate) {
      throw createError('Due date cannot be before the start date', 422);
    }

    const memberIds = await sanitizeMembers(workspaceId, data.members || []);
    const members = [...new Set([req.userId, ...memberIds])];

    const project = await Project.create({
      ...data,
      startDate: startDate ?? null,
      dueDate: dueDate ?? null,
      members,
      workspace: workspaceId,
      owner: req.userId,
    });

    await project.populate('owner', 'name avatar');
    await project.populate('members', 'name avatar');

    await recordActivity({
      workspace: workspaceId, project: project._id, actor: req.userId,
      type: 'project.created', summary: `created project "${project.name}"`,
      data: { projectName: project.name },
    });

    res.status(201).json({ success: true, data: { project: withCounts(project) } });
  } catch (err) {
    next(err);
  }
};

// ── Update project ─────────────────────────────────────────────────────────────
export const updateProject = async (req, res, next) => {
  try {
    const { workspaceId, projectId } = req.params;
    const updates = projectSchema.partial().parse(req.body);

    const before = await Project.findOne({ _id: projectId, workspace: workspaceId });
    if (!before) throw createError('Project not found', 404);

    const payload = { ...updates };
    if (updates.startDate !== undefined) payload.startDate = parseDate(updates.startDate, 'startDate');
    if (updates.dueDate !== undefined) payload.dueDate = parseDate(updates.dueDate, 'dueDate');
    if (updates.members) {
      const valid = await sanitizeMembers(workspaceId, updates.members);
      payload.members = [...new Set([before.owner.toString(), ...valid])];
    }

    const project = await Project.findByIdAndUpdate(projectId, payload, { new: true, runValidators: true })
      .populate('owner', 'name avatar')
      .populate('members', 'name avatar email');

    if (updates.status && updates.status !== before.status) {
      await recordActivity({
        workspace: workspaceId, project: projectId, actor: req.userId,
        type: 'project.status_changed',
        summary: `changed project status to ${updates.status.replace('_', ' ')}`,
        data: { from: before.status, to: updates.status },
      });
    }

    res.json({ success: true, data: { project } });
  } catch (err) {
    next(err);
  }
};

// ── Archive / restore ──────────────────────────────────────────────────────────
export const archiveProject = async (req, res, next) => {
  try {
    const { workspaceId, projectId } = req.params;
    const project = await Project.findOneAndUpdate(
      { _id: projectId, workspace: workspaceId },
      { isArchived: true, status: 'archived' },
      { new: true },
    );
    if (!project) throw createError('Project not found', 404);

    await recordActivity({
      workspace: workspaceId, project: projectId, actor: req.userId,
      type: 'project.archived', summary: `archived project "${project.name}"`,
      data: { projectName: project.name },
    });

    res.json({ success: true, data: { project } });
  } catch (err) {
    next(err);
  }
};

export const restoreProject = async (req, res, next) => {
  try {
    const { workspaceId, projectId } = req.params;
    const project = await Project.findOneAndUpdate(
      { _id: projectId, workspace: workspaceId },
      { isArchived: false, status: 'active' },
      { new: true },
    ).populate('owner', 'name avatar').populate('members', 'name avatar');
    if (!project) throw createError('Project not found', 404);

    await recordActivity({
      workspace: workspaceId, project: projectId, actor: req.userId,
      type: 'project.restored', summary: `restored project "${project.name}"`,
      data: { projectName: project.name },
    });

    res.json({ success: true, data: { project } });
  } catch (err) {
    next(err);
  }
};

// ── Delete project ─────────────────────────────────────────────────────────────
export const deleteProject = async (req, res, next) => {
  try {
    const { workspaceId, projectId } = req.params;
    const project = await Project.findOneAndDelete({ _id: projectId, workspace: workspaceId });
    if (!project) throw createError('Project not found', 404);

    const tasks = await Task.find({ project: projectId }).select('_id');
    const taskIds = tasks.map((t) => t._id);

    await Promise.all([
      Task.deleteMany({ project: projectId }),
      Comment.deleteMany({ task: { $in: taskIds } }),
      TaskDependency.deleteMany({ project: projectId }),
      Activity.deleteMany({ project: projectId }),
    ]);

    res.json({ success: true, message: 'Project and its tasks were deleted' });
  } catch (err) {
    next(err);
  }
};

// ── Project activity ───────────────────────────────────────────────────────────
export const getProjectActivity = async (req, res, next) => {
  try {
    const { workspaceId, projectId } = req.params;
    const project = await Project.findOne({ _id: projectId, workspace: workspaceId });
    if (!project) throw createError('Project not found', 404);

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);

    const activities = await Activity.find({ project: projectId })
      .populate('actor', 'name avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, data: { activities } });
  } catch (err) {
    next(err);
  }
};

export default {
  getProjects, getProject, createProject, updateProject,
  archiveProject, restoreProject, deleteProject, getProjectActivity,
};
