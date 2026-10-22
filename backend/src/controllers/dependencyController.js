/**
 * Task Dependency Controller
 * Routes: /api/workspaces/:workspaceId/tasks/:taskId/dependencies
 *         /api/workspaces/:workspaceId/projects/:projectId/dependency-graph
 */
import { z } from 'zod';
import TaskDependency from '../models/TaskDependency.js';
import Task from '../models/Task.js';
import { createError } from '../middleware/errorHandler.js';
import { topologicalSort } from '../services/cpmService.js';

const depCreateSchema = z.object({
  predecessorId: z.string().min(1),
  type: z.enum(['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish']).optional().default('finish_to_start'),
});

// ── Get task dependencies ──────────────────────────────────────────────────────
export const getTaskDependencies = async (req, res, next) => {
  try {
    const { workspaceId, taskId } = req.params;

    // Verify task belongs to workspace
    const task = await Task.findOne({ _id: taskId, workspace: workspaceId });
    if (!task) throw createError('Task not found', 404);

    const [predecessorDeps, successorDeps] = await Promise.all([
      TaskDependency.find({ successor: taskId, workspace: workspaceId })
        .populate('predecessor', 'title status priority dueDate assignee')
        .sort({ createdAt: 1 }),
      TaskDependency.find({ predecessor: taskId, workspace: workspaceId })
        .populate('successor', 'title status priority dueDate assignee')
        .sort({ createdAt: 1 }),
    ]);

    const predecessors = predecessorDeps.map((d) => ({
      dependencyId: d._id,
      type: d.type,
      task: d.predecessor,
    }));

    const successors = successorDeps.map((d) => ({
      dependencyId: d._id,
      type: d.type,
      task: d.successor,
    }));

    const isBlocked = predecessors.some((p) => p.task && p.task.status !== 'done');

    res.json({ success: true, data: { predecessors, successors, isBlocked } });
  } catch (err) {
    next(err);
  }
};

// ── Add dependency ─────────────────────────────────────────────────────────────
export const addDependency = async (req, res, next) => {
  try {
    const { workspaceId, taskId } = req.params;
    const { predecessorId, type } = depCreateSchema.parse(req.body);

    // Prevent self-dependency
    if (predecessorId === taskId) {
      throw createError('A task cannot depend on itself', 422);
    }

    // Verify both tasks exist in the same workspace
    const [successorTask, predecessorTask] = await Promise.all([
      Task.findOne({ _id: taskId, workspace: workspaceId }),
      Task.findOne({ _id: predecessorId, workspace: workspaceId }),
    ]);

    if (!successorTask) throw createError('Successor task not found', 404);
    if (!predecessorTask) throw createError('Predecessor task not found', 404);

    // Check same project (cross-project dependencies not supported yet)
    if (successorTask.project.toString() !== predecessorTask.project.toString()) {
      throw createError('Cross-project dependencies are not currently supported', 422);
    }

    // Check if dependency already exists
    const existing = await TaskDependency.findOne({
      predecessor: predecessorId,
      successor: taskId,
    });
    if (existing) throw createError('This dependency already exists', 409);

    // Cycle detection: would adding predecessor→taskId create a cycle?
    // Load all existing deps in the project
    const allDeps = await TaskDependency.find({
      workspace: workspaceId,
      project: successorTask.project,
    }).select('predecessor successor');

    // Build adjacency map and check: if taskId can reach predecessorId via existing edges,
    // adding predecessorId→taskId would create a cycle.
    const projectTasks = await Task.find({ project: successorTask.project }).select('_id');
    const nodeIds = projectTasks.map((t) => t._id.toString());

    // Add the new proposed edge
    const proposedDeps = [...allDeps, { predecessor: predecessorId, successor: taskId }];
    const adjacency = new Map(nodeIds.map((id) => [id, []]));

    for (const dep of proposedDeps) {
      const pred = dep.predecessor.toString();
      const succ = dep.successor.toString();
      if (adjacency.has(pred) && adjacency.has(succ)) {
        adjacency.get(pred).push(succ);
      }
    }

    const { hasCycle } = topologicalSort(nodeIds, adjacency);
    if (hasCycle) {
      throw createError(
        'Adding this dependency would create a circular dependency chain, which is not allowed.',
        422
      );
    }

    // Create the dependency
    const dependency = await TaskDependency.create({
      workspace: workspaceId,
      project: successorTask.project,
      predecessor: predecessorId,
      successor: taskId,
      type,
      createdBy: req.userId,
    });

    await dependency.populate('predecessor', 'title status priority dueDate');
    await dependency.populate('successor', 'title status priority dueDate');

    res.status(201).json({ success: true, data: { dependency } });
  } catch (err) {
    next(err);
  }
};

// ── Remove dependency ──────────────────────────────────────────────────────────
export const removeDependency = async (req, res, next) => {
  try {
    const { workspaceId, taskId, dependencyId } = req.params;

    const dep = await TaskDependency.findOneAndDelete({
      _id: dependencyId,
      workspace: workspaceId,
      $or: [{ predecessor: taskId }, { successor: taskId }],
    });

    if (!dep) throw createError('Dependency not found', 404);

    res.json({ success: true, message: 'Dependency removed' });
  } catch (err) {
    next(err);
  }
};

// ── Get project dependency graph ───────────────────────────────────────────────
export const getProjectDependencyGraph = async (req, res, next) => {
  try {
    const { workspaceId, projectId } = req.params;

    const [tasks, deps] = await Promise.all([
      Task.find({ workspace: workspaceId, project: projectId })
        .populate('assignee', 'name avatar')
        .select('title status priority dueDate startDate durationDays assignee'),
      TaskDependency.find({ workspace: workspaceId, project: projectId })
        .select('predecessor successor type'),
    ]);

    // Format as graph nodes and edges for frontend rendering
    const nodes = tasks.map((t) => ({
      id: t._id.toString(),
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      startDate: t.startDate,
      assignee: t.assignee,
    }));

    const edges = deps.map((d) => ({
      id: d._id.toString(),
      predecessor: d.predecessor.toString(),
      successor: d.successor.toString(),
      type: d.type,
    }));

    // Identify blocked tasks
    const blockedTaskIds = new Set();
    for (const edge of edges) {
      const predTask = tasks.find((t) => t._id.toString() === edge.predecessor);
      if (predTask && predTask.status !== 'done') {
        blockedTaskIds.add(edge.successor);
      }
    }

    res.json({
      success: true,
      data: {
        nodes: nodes.map((n) => ({ ...n, isBlocked: blockedTaskIds.has(n.id) })),
        edges,
      },
    });
  } catch (err) {
    next(err);
  }
};
