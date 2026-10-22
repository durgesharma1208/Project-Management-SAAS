/**
 * Critical Path Controller
 * Route: GET /api/workspaces/:workspaceId/projects/:projectId/critical-path
 */
import Task from '../models/Task.js';
import TaskDependency from '../models/TaskDependency.js';
import Project from '../models/Project.js';
import { createError } from '../middleware/errorHandler.js';
import { computeCriticalPath } from '../services/cpmService.js';

export const getCriticalPath = async (req, res, next) => {
  try {
    const { workspaceId, projectId } = req.params;

    // Verify project belongs to workspace
    const project = await Project.findOne({ _id: projectId, workspace: workspaceId });
    if (!project) throw createError('Project not found', 404);

    // Load all tasks and dependencies
    const [tasks, deps] = await Promise.all([
      Task.find({ workspace: workspaceId, project: projectId })
        .select('title status priority durationDays startDate dueDate estimatedHours'),
      TaskDependency.find({ workspace: workspaceId, project: projectId })
        .select('predecessor successor type'),
    ]);

    // Run CPM algorithm
    const cpmResult = computeCriticalPath(tasks, deps);

    // Enrich results with additional task metadata for UI
    const taskMap = new Map(tasks.map((t) => [t._id.toString(), t]));

    const enrichedResults = cpmResult.results.map((r) => {
      const task = taskMap.get(r.taskId);
      return {
        ...r,
        status: task?.status,
        priority: task?.priority,
        startDate: task?.startDate,
        dueDate: task?.dueDate,
      };
    });

    res.json({
      success: true,
      data: {
        status: cpmResult.status,
        projectId,
        projectName: project.name,
        projectFinish: cpmResult.projectFinish,
        totalDuration: cpmResult.totalDuration,
        criticalPaths: cpmResult.criticalPaths,
        criticalTaskIds: cpmResult.criticalTaskIds || [],
        results: enrichedResults,
        warnings: cpmResult.warnings,
        excludedTaskCount: cpmResult.excludedTaskCount || 0,
        totalTaskCount: tasks.length,
        error: cpmResult.error || null,
      },
    });
  } catch (err) {
    next(err);
  }
};
