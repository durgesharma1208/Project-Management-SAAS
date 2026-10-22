import { z } from 'zod';
import mongoose from 'mongoose';
import Task, { TASK_STATUSES, TASK_PRIORITIES } from '../models/Task.js';
import Project from '../models/Project.js';
import Membership from '../models/Membership.js';
import Activity from '../models/Activity.js';
import Comment from '../models/Comment.js';
import TaskDependency from '../models/TaskDependency.js';
import { createError } from '../middleware/errorHandler.js';
import { validateTransition } from '../services/workflowService.js';
import {
  buildTaskFilter,
  buildTaskSort,
  buildPagination,
  priorityRankExpression,
} from '../services/taskQuery.js';

const taskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  project: z.string(),
  assignee: z.string().optional().nullable(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  labels: z.array(z.string().max(40)).max(20).optional(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  estimatedHours: z.number().min(0).optional().nullable(),
  durationDays: z.number().min(0).optional().nullable(),
  subtasks: z.array(z.object({
    title: z.string().min(1),
    isCompleted: z.boolean().optional(),
    assignee: z.string().optional().nullable(),
  })).optional(),
});

const TASK_POPULATE = [
  { path: 'assignee', select: 'name avatar email' },
  { path: 'creator', select: 'name avatar' },
  { path: 'project', select: 'name color emoji' },
];

const recordActivity = async (data) => {
  try { await Activity.create(data); } catch (e) { console.error('Activity error:', e.message); }
};

const parseDate = (value, field) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${field} is not a valid date`, 422);
  return date;
};

/** Ensure an assignee is an active member of the workspace. */
const assertAssigneeIsMember = async (workspaceId, assignee) => {
  if (!assignee) return;
  const membership = await Membership.findOne({ workspace: workspaceId, user: assignee });
  if (!membership) throw createError('Assignee must be a member of this workspace', 422);
};

/** Load a task that belongs to the workspace, or throw a 404. */
const getScopedTask = async (workspaceId, taskId) => {
  const task = await Task.findOne({ _id: taskId, workspace: workspaceId });
  if (!task) throw createError('Task not found', 404);
  return task;
};

const assertDateOrder = (startDate, dueDate) => {
  if (startDate && dueDate && new Date(dueDate) < new Date(startDate)) {
    throw createError('Due date cannot be before the start date', 422);
  }
};

// ── List tasks ─────────────────────────────────────────────────────────────────
export const getTasks = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const filter = buildTaskFilter({ workspaceId, userId: req.userId, query: req.query });
    const { page, limit, skip } = buildPagination(req.query, { defaultLimit: 50 });
    const sort = buildTaskSort(req.query);

    const useAggregation = req.query.sort === 'priority' || req.query.sort === 'status';

    let tasks;
    let total;

    if (useAggregation) {
      const rankField = req.query.sort === 'priority' ? priorityRankExpression : {
        $indexOfArray: [['backlog', 'todo', 'in_progress', 'in_review', 'done'], '$status'],
      };
      const direction = req.query.dir === 'desc' ? -1 : 1;

      const pipeline = [
        { $match: filter },
        { $addFields: { _rank: rankField } },
        { $sort: { _rank: direction, position: 1, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $lookup: { from: 'users', localField: 'assignee', foreignField: '_id', as: '_assignee' } },
        { $lookup: { from: 'users', localField: 'creator', foreignField: '_id', as: '_creator' } },
        { $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: '_project' } },
        {
          $addFields: {
            assignee: { $ifNull: [{ $arrayElemAt: ['$_assignee', 0] }, null] },
            creator: { $ifNull: [{ $arrayElemAt: ['$_creator', 0] }, null] },
            project: { $ifNull: [{ $arrayElemAt: ['$_project', 0] }, null] },
          },
        },
        {
          $project: {
            _rank: 0, _assignee: 0, _creator: 0, _project: 0,
            'assignee.password': 0, 'assignee.refreshTokens': 0,
            'assignee.passwordResetToken': 0, 'assignee.passwordResetExpires': 0,
            'creator.password': 0, 'creator.refreshTokens': 0,
          },
        },
      ];

      [tasks, total] = await Promise.all([
        Task.aggregate(pipeline),
        Task.countDocuments(filter),
      ]);
    } else {
      [tasks, total] = await Promise.all([
        Task.find(filter)
          .populate(TASK_POPULATE)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean({ virtuals: false }),
        Task.countDocuments(filter),
      ]);
    }

    res.json({
      success: true,
      data: {
        tasks,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        sort: req.query.sort || 'manual',
        dir: req.query.dir || 'desc',
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── Get single task ────────────────────────────────────────────────────────────
export const getTask = async (req, res, next) => {
  try {
    const { workspaceId, taskId } = req.params;
    const task = await Task.findOne({ _id: taskId, workspace: workspaceId })
      .populate('assignee', 'name avatar email')
      .populate('creator', 'name avatar')
      .populate('project', 'name color emoji')
      .populate('subtasks.assignee', 'name avatar');
    if (!task) throw createError('Task not found', 404);
    res.json({ success: true, data: { task } });
  } catch (err) {
    next(err);
  }
};

// ── Create task ────────────────────────────────────────────────────────────────
export const createTask = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const data = taskSchema.parse(req.body);

    const project = await Project.findOne({ _id: data.project, workspace: workspaceId, isArchived: false });
    if (!project) throw createError('Project not found in this workspace', 404);

    await assertAssigneeIsMember(workspaceId, data.assignee || null);

    const startDate = parseDate(data.startDate, 'startDate');
    const dueDate = parseDate(data.dueDate, 'dueDate');
    assertDateOrder(startDate, dueDate);

    const status = data.status || 'backlog';

    const lastTask = await Task.findOne({ project: data.project, status })
      .sort({ position: -1 })
      .select('position');
    const position = (lastTask?.position ?? -1) + 1;

    const task = await Task.create({
      ...data,
      startDate: startDate ?? null,
      dueDate: dueDate ?? null,
      status,
      workspace: workspaceId,
      creator: req.userId,
      position,
      labels: (data.labels || []).map((l) => l.trim()).filter(Boolean),
    });
    await task.populate(TASK_POPULATE);

    await recordActivity({
      workspace: workspaceId, project: data.project, task: task._id, actor: req.userId,
      type: 'task.created', summary: `created task "${task.title}"`,
      data: { taskTitle: task.title },
    });

    res.status(201).json({ success: true, data: { task } });
  } catch (err) {
    next(err);
  }
};

// ── Update task ────────────────────────────────────────────────────────────────
export const updateTask = async (req, res, next) => {
  try {
    const { workspaceId, taskId } = req.params;
    const updates = taskSchema.partial().parse(req.body);

    const before = await getScopedTask(workspaceId, taskId);

    if (updates.project && updates.project !== before.project.toString()) {
      const targetProject = await Project.findOne({ _id: updates.project, workspace: workspaceId });
      if (!targetProject) throw createError('Target project not found in this workspace', 404);
    }

    if (updates.assignee !== undefined) {
      await assertAssigneeIsMember(workspaceId, updates.assignee || null);
    }

    if (updates.status && updates.status !== before.status) {
      await validateTransition(before.project.toString(), workspaceId, before.status, updates.status);
    }

    const startDate = parseDate(updates.startDate, 'startDate');
    const dueDate = parseDate(updates.dueDate, 'dueDate');
    assertDateOrder(
      startDate === undefined ? before.startDate : startDate,
      dueDate === undefined ? before.dueDate : dueDate,
    );

    const payload = { ...updates };
    if (startDate !== undefined) payload.startDate = startDate;
    if (dueDate !== undefined) payload.dueDate = dueDate;
    if (updates.labels) payload.labels = updates.labels.map((l) => l.trim()).filter(Boolean);

    const task = await Task.findByIdAndUpdate(taskId, payload, { new: true, runValidators: true })
      .populate(TASK_POPULATE);

    const base = { workspace: workspaceId, project: task.project?._id || task.project, task: task._id, actor: req.userId };

    if (updates.status && updates.status !== before.status) {
      await recordActivity({
        ...base,
        type: 'task.status_changed',
        summary: `moved "${task.title}" from ${before.status.replace('_', ' ')} to ${updates.status.replace('_', ' ')}`,
        data: { from: before.status, to: updates.status, taskTitle: task.title },
      });
    }
    if (updates.assignee !== undefined && String(updates.assignee || '') !== String(before.assignee || '')) {
      await recordActivity({
        ...base,
        type: 'task.assigned',
        summary: updates.assignee ? `assigned "${task.title}"` : `unassigned "${task.title}"`,
        data: { taskTitle: task.title, assignee: updates.assignee || null },
      });
    }
    if (updates.dueDate !== undefined && String(dueDate) !== String(before.dueDate)) {
      await recordActivity({
        ...base,
        type: 'task.updated',
        summary: dueDate ? `set the due date of "${task.title}"` : `cleared the due date of "${task.title}"`,
        data: { dueDate, taskTitle: task.title },
      });
    }

    res.json({ success: true, data: { task } });
  } catch (err) {
    next(err);
  }
};

// ── Move task (Kanban status + position) ───────────────────────────────────────
export const moveTask = async (req, res, next) => {
  try {
    const { workspaceId, taskId } = req.params;
    const { status, position } = z.object({
      status: z.enum(TASK_STATUSES),
      position: z.number().int().min(0).optional(),
    }).parse(req.body);

    const task = await getScopedTask(workspaceId, taskId);
    const oldStatus = task.status;

    await validateTransition(task.project.toString(), workspaceId, oldStatus, status);

    task.status = status;

    if (position !== undefined) {
      task.position = position;
    } else if (oldStatus !== status) {
      const last = await Task.findOne({ project: task.project, status }).sort({ position: -1 }).select('position');
      task.position = (last?.position ?? -1) + 1;
    }

    await task.save();

    if (oldStatus !== status) {
      await recordActivity({
        workspace: workspaceId, project: task.project, task: taskId, actor: req.userId,
        type: 'task.status_changed',
        summary: `moved "${task.title}" from ${oldStatus.replace('_', ' ')} to ${status.replace('_', ' ')}`,
        data: { from: oldStatus, to: status, taskTitle: task.title },
      });
    }

    await task.populate(TASK_POPULATE);
    res.json({ success: true, data: { task } });
  } catch (err) {
    next(err);
  }
};

// ── Delete task ────────────────────────────────────────────────────────────────
export const deleteTask = async (req, res, next) => {
  try {
    const { workspaceId, taskId } = req.params;
    const task = await Task.findOneAndDelete({ _id: taskId, workspace: workspaceId });
    if (!task) throw createError('Task not found', 404);

    // Clean up dependent records so no orphan data is left behind
    await Promise.all([
      Comment.deleteMany({ task: taskId }),
      TaskDependency.deleteMany({ $or: [{ predecessor: taskId }, { successor: taskId }] }),
    ]);

    await recordActivity({
      workspace: workspaceId, project: task.project, actor: req.userId,
      type: 'task.deleted', summary: `deleted task "${task.title}"`,
      data: { taskTitle: task.title },
    });

    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
};

// ── Activity ───────────────────────────────────────────────────────────────────
export const getTaskActivity = async (req, res, next) => {
  try {
    const { workspaceId, taskId } = req.params;
    await getScopedTask(workspaceId, taskId);
    const activities = await Activity.find({ task: taskId })
      .populate('actor', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: { activities } });
  } catch (err) {
    next(err);
  }
};

// ── Subtasks ───────────────────────────────────────────────────────────────────
export const addSubtask = async (req, res, next) => {
  try {
    const { workspaceId, taskId } = req.params;
    const { title, assignee } = z.object({
      title: z.string().min(1).max(500),
      assignee: z.string().optional().nullable(),
    }).parse(req.body);

    const task = await getScopedTask(workspaceId, taskId);
    await assertAssigneeIsMember(workspaceId, assignee || null);

    task.subtasks.push({ title: title.trim(), assignee: assignee || null });
    await task.save();
    await task.populate(TASK_POPULATE);
    res.status(201).json({ success: true, data: { task } });
  } catch (err) {
    next(err);
  }
};

export const toggleSubtask = async (req, res, next) => {
  try {
    const { workspaceId, taskId, subtaskId } = req.params;
    const task = await getScopedTask(workspaceId, taskId);
    const sub = task.subtasks.id(subtaskId);
    if (!sub) throw createError('Subtask not found', 404);
    sub.isCompleted = !sub.isCompleted;
    await task.save();
    await task.populate(TASK_POPULATE);
    res.json({ success: true, data: { task } });
  } catch (err) {
    next(err);
  }
};

export const deleteSubtask = async (req, res, next) => {
  try {
    const { workspaceId, taskId, subtaskId } = req.params;
    const task = await getScopedTask(workspaceId, taskId);
    const sub = task.subtasks.id(subtaskId);
    if (!sub) throw createError('Subtask not found', 404);
    sub.deleteOne();
    await task.save();
    await task.populate(TASK_POPULATE);
    res.json({ success: true, data: { task } });
  } catch (err) {
    next(err);
  }
};

// ── Comments ───────────────────────────────────────────────────────────────────
export const getComments = async (req, res, next) => {
  try {
    const { workspaceId, taskId } = req.params;
    await getScopedTask(workspaceId, taskId);
    const comments = await Comment.find({ task: taskId, workspace: workspaceId })
      .populate('author', 'name avatar')
      .sort({ createdAt: 1 });
    res.json({ success: true, data: { comments } });
  } catch (err) {
    next(err);
  }
};

export const addComment = async (req, res, next) => {
  try {
    const { workspaceId, taskId } = req.params;
    const { content } = z.object({ content: z.string().min(1).max(5000) }).parse(req.body);
    const task = await getScopedTask(workspaceId, taskId);

    const comment = await Comment.create({
      task: taskId, workspace: workspaceId, author: req.userId, content: content.trim(),
    });
    await comment.populate('author', 'name avatar');

    await recordActivity({
      workspace: workspaceId, project: task.project, task: taskId, actor: req.userId,
      type: 'task.commented', summary: `commented on "${task.title}"`,
      data: { taskTitle: task.title },
    });

    res.status(201).json({ success: true, data: { comment } });
  } catch (err) {
    next(err);
  }
};

export const updateComment = async (req, res, next) => {
  try {
    const { workspaceId, commentId } = req.params;
    const { content } = z.object({ content: z.string().min(1).max(5000) }).parse(req.body);
    const comment = await Comment.findOne({ _id: commentId, workspace: workspaceId, author: req.userId });
    if (!comment) throw createError('Comment not found or not yours', 404);
    comment.content = content.trim();
    comment.isEdited = true;
    await comment.save();
    await comment.populate('author', 'name avatar');
    res.json({ success: true, data: { comment } });
  } catch (err) {
    next(err);
  }
};

export const deleteComment = async (req, res, next) => {
  try {
    const { workspaceId, commentId } = req.params;
    const comment = await Comment.findOne({ _id: commentId, workspace: workspaceId });
    if (!comment) throw createError('Comment not found', 404);

    const isAuthor = comment.author.toString() === req.userId;
    const canModerate = ['admin', 'owner'].includes(req.membership?.role);
    if (!isAuthor && !canModerate) throw createError('You can only delete your own comments', 403);

    await comment.deleteOne();
    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
};

// ── Dashboard ──────────────────────────────────────────────────────────────────
export const getDashboard = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const inSevenDays = new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevWeek = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      statusSummary,
      prioritySummary,
      overdueCount,
      dueTodayCount,
      unassignedCount,
      projectCount,
      activeProjectCount,
      myOpenCount,
      completedThisWeek,
      completedPrevWeek,
      myTasks,
      dueSoon,
      overdueTasks,
      recentActivity,
      projects,
    ] = await Promise.all([
      Task.aggregate([
        { $match: { workspace: workspaceObjectId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Task.aggregate([
        { $match: { workspace: workspaceObjectId, status: { $ne: 'done' } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      Task.countDocuments({ workspace: workspaceId, status: { $ne: 'done' }, dueDate: { $lt: startOfDay } }),
      Task.countDocuments({ workspace: workspaceId, status: { $ne: 'done' }, dueDate: { $gte: startOfDay, $lt: endOfDay } }),
      Task.countDocuments({ workspace: workspaceId, status: { $ne: 'done' }, assignee: null }),
      Project.countDocuments({ workspace: workspaceId, isArchived: false }),
      Project.countDocuments({ workspace: workspaceId, isArchived: false, status: 'active' }),
      Task.countDocuments({ workspace: workspaceId, assignee: req.userId, status: { $ne: 'done' } }),
      Activity.countDocuments({ workspace: workspaceId, type: 'task.status_changed', 'data.to': 'done', createdAt: { $gte: weekAgo } }),
      Activity.countDocuments({ workspace: workspaceId, type: 'task.status_changed', 'data.to': 'done', createdAt: { $gte: prevWeek, $lt: weekAgo } }),
      Task.find({ workspace: workspaceId, assignee: req.userId, status: { $ne: 'done' } })
        .populate('project', 'name color emoji')
        .sort({ dueDate: 1 })
        .limit(8),
      Task.find({ workspace: workspaceId, dueDate: { $gte: startOfDay, $lte: inSevenDays }, status: { $ne: 'done' } })
        .populate('assignee', 'name avatar')
        .populate('project', 'name color')
        .sort({ dueDate: 1 })
        .limit(8),
      Task.find({ workspace: workspaceId, dueDate: { $lt: startOfDay }, status: { $ne: 'done' } })
        .populate('assignee', 'name avatar')
        .populate('project', 'name color')
        .sort({ dueDate: 1 })
        .limit(5),
      Activity.find({ workspace: workspaceId })
        .populate('actor', 'name avatar')
        .populate('project', 'name emoji color')
        .sort({ createdAt: -1 })
        .limit(10),
      Project.find({ workspace: workspaceId, isArchived: false })
        .populate('members', 'name avatar')
        .sort({ updatedAt: -1 })
        .limit(5),
    ]);

    // Task counts for the recent projects
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

    const projectsWithCounts = projects.map((p) => {
      const counts = countMap[p._id.toString()] || {};
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const completed = counts.done || 0;
      return {
        ...p.toJSON(),
        taskCounts: counts,
        totalTasks: total,
        completedTasks: completed,
        progress: total ? Math.round((completed / total) * 100) : 0,
      };
    });

    const statusMap = {};
    statusSummary.forEach(({ _id, count }) => { statusMap[_id] = count; });
    const totalTasks = statusSummary.reduce((sum, s) => sum + s.count, 0);

    res.json({
      success: true,
      data: {
        counts: {
          totalTasks,
          completedTasks: statusMap.done || 0,
          openTasks: totalTasks - (statusMap.done || 0),
          inProgressTasks: statusMap.in_progress || 0,
          overdueTasks: overdueCount,
          dueTodayTasks: dueTodayCount,
          unassignedTasks: unassignedCount,
          projectCount,
          activeProjectCount,
          myOpenTasks: myOpenCount,
          completedThisWeek,
          completedPrevWeek,
        },
        statusSummary,
        prioritySummary,
        myTasks,
        dueSoon,
        overdueTasks,
        recentActivity,
        projects: projectsWithCounts,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── Calendar tasks ─────────────────────────────────────────────────────────────
export const getCalendarTasks = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { startDate, endDate, project, assignee, status } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }

    const filter = {
      workspace: workspaceId,
      $or: [
        { dueDate: { $gte: start, $lte: end } },
        { startDate: { $gte: start, $lte: end } },
        { startDate: { $lte: start }, dueDate: { $gte: end } },
      ],
    };

    if (project) filter.project = project;
    if (assignee) filter.assignee = assignee === 'me' ? req.userId : assignee;
    if (status) filter.status = status;

    const tasks = await Task.find(filter)
      .populate('assignee', 'name avatar')
      .populate('project', 'name color emoji')
      .sort({ dueDate: 1 })
      .limit(500);

    res.json({ success: true, data: { tasks } });
  } catch (err) {
    next(err);
  }
};

// ── Update task schedule (Gantt / calendar) ───────────────────────────────────
export const scheduleTask = async (req, res, next) => {
  try {
    const { workspaceId, taskId } = req.params;
    const updates = z.object({
      startDate: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
      durationDays: z.number().min(0).nullable().optional(),
    }).parse(req.body);

    const before = await getScopedTask(workspaceId, taskId);

    const startDate = parseDate(updates.startDate, 'startDate');
    const dueDate = parseDate(updates.dueDate, 'dueDate');
    assertDateOrder(
      startDate === undefined ? before.startDate : startDate,
      dueDate === undefined ? before.dueDate : dueDate,
    );

    const payload = {};
    if (startDate !== undefined) payload.startDate = startDate;
    if (dueDate !== undefined) payload.dueDate = dueDate;
    if (updates.durationDays !== undefined) payload.durationDays = updates.durationDays;

    const task = await Task.findByIdAndUpdate(taskId, payload, { new: true, runValidators: true })
      .populate(TASK_POPULATE);

    await recordActivity({
      workspace: workspaceId, project: task.project?._id || task.project, task: taskId, actor: req.userId,
      type: 'task.scheduled',
      summary: `rescheduled "${task.title}"`,
      data: { startDate: payload.startDate, dueDate: payload.dueDate, taskTitle: task.title },
    });

    res.json({ success: true, data: { task } });
  } catch (err) {
    next(err);
  }
};

export default {
  getTasks, getTask, createTask, updateTask, moveTask, deleteTask,
  getTaskActivity, addSubtask, toggleSubtask, deleteSubtask,
  getComments, addComment, updateComment, deleteComment,
  getDashboard, getCalendarTasks, scheduleTask,
};
