import { z } from 'zod';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Activity from '../models/Activity.js';
import Membership from '../models/Membership.js';
import { createError } from '../middleware/errorHandler.js';

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(['planned', 'active', 'on_hold', 'completed', 'archived']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  color: z.string().optional(),
  emoji: z.string().optional(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  team: z.string().optional().nullable(),
  members: z.array(z.string()).optional(),
});

const recordActivity = async ({ workspace, project, actor, type, summary, data = {} }) => {
  try {
    await Activity.create({ workspace, project, actor, type, summary, data });
  } catch (e) {
    console.error('Activity record failed:', e.message);
  }
};

// ── List projects ──────────────────────────────────────────────────────────────
export const getProjects = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { status, search, archived } = req.query;

    const filter = { workspace: workspaceId };
    if (archived === 'true') {
      filter.isArchived = true;
    } else {
      filter.isArchived = false;
    }
    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const projects = await Project.find(filter)
      .populate('owner', 'name avatar')
      .populate('members', 'name avatar')
      .sort({ updatedAt: -1 });

    // Add task counts
    const projectIds = projects.map((p) => p._id);
    const taskCounts = await Task.aggregate([
      { $match: { project: { $in: projectIds } } },
      { $group: { _id: { project: '$project', status: '$status' }, count: { $sum: 1 } } },
    ]);

    const countMap = {};
    taskCounts.forEach(({ _id, count }) => {
      const key = _id.project.toString();
      if (!countMap[key]) countMap[key] = {};
      countMap[key][_id.status] = count;
    });

    const result = projects.map((p) => {
      const counts = countMap[p._id.toString()] || {};
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const done = counts.done || 0;
      return { ...p.toJSON(), taskCounts: counts, totalTasks: total, completedTasks: done };
    });

    res.json({ success: true, data: { projects: result } });
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
      .populate('members', 'name avatar email')
      .populate('team', 'name color emoji');
    if (!project) throw createError('Project not found', 404);

    const taskCounts = await Task.aggregate([
      { $match: { project: project._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const counts = {};
    taskCounts.forEach(({ _id, count }) => { counts[_id] = count; });

    res.json({ success: true, data: { project, taskCounts: counts } });
  } catch (err) {
    next(err);
  }
};

// ── Create project ─────────────────────────────────────────────────────────────
export const createProject = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const data = projectSchema.parse(req.body);

    const members = [...new Set([req.userId, ...(data.members || [])])];
    const project = await Project.create({
      ...data,
      workspace: workspaceId,
      owner: req.userId,
      members,
    });

    await project.populate('owner', 'name avatar');
    await project.populate('members', 'name avatar');

    await recordActivity({
      workspace: workspaceId, project: project._id, actor: req.userId,
      type: 'project.created', summary: `Project "${project.name}" created`,
      data: { projectName: project.name },
    });

    res.status(201).json({ success: true, data: { project } });
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

    const project = await Project.findByIdAndUpdate(projectId, updates, { new: true })
      .populate('owner', 'name avatar')
      .populate('members', 'name avatar');

    if (updates.status && updates.status !== before.status) {
      await recordActivity({
        workspace: workspaceId, project: projectId, actor: req.userId,
        type: 'project.status_changed',
        summary: `Status changed from "${before.status}" to "${updates.status}"`,
        data: { from: before.status, to: updates.status },
      });
    }

    res.json({ success: true, data: { project } });
  } catch (err) {
    next(err);
  }
};

// ── Archive project ────────────────────────────────────────────────────────────
export const archiveProject = async (req, res, next) => {
  try {
    const { workspaceId, projectId } = req.params;
    const project = await Project.findOneAndUpdate(
      { _id: projectId, workspace: workspaceId },
      { isArchived: true, status: 'archived' },
      { new: true }
    );
    if (!project) throw createError('Project not found', 404);
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
    // Cascade delete tasks (keep activities as history)
    await Task.deleteMany({ project: projectId });
    res.json({ success: true, message: 'Project deleted' });
  } catch (err) {
    next(err);
  }
};

// ── Get project activity ───────────────────────────────────────────────────────
export const getProjectActivity = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

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
  getProjects, getProject, createProject, updateProject, archiveProject, deleteProject, getProjectActivity
};
