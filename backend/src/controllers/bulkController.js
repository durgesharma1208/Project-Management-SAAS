/**
 * Bulk Task Actions Controller
 * Route: POST /api/workspaces/:workspaceId/tasks/bulk
 */
import { z } from 'zod';
import Task, { TASK_STATUSES, TASK_PRIORITIES } from '../models/Task.js';
import Activity from '../models/Activity.js';
import { createError } from '../middleware/errorHandler.js';
import { validateTransition } from '../services/workflowService.js';

const bulkSchema = z.object({
  taskIds: z.array(z.string()).min(1).max(100),
  action: z.enum(['set_status', 'set_priority', 'set_assignee', 'add_labels', 'remove_labels', 'set_due_date', 'delete']),
  value: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
});

const recordActivity = async (data) => {
  try { await Activity.create(data); } catch (e) { console.error('Activity error:', e.message); }
};

export const bulkUpdateTasks = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { taskIds, action, value } = bulkSchema.parse(req.body);

    // Load all referenced tasks in this workspace
    const tasks = await Task.find({ _id: { $in: taskIds }, workspace: workspaceId });

    if (tasks.length === 0) {
      throw createError('No matching tasks found in this workspace', 404);
    }

    const results = { success: [], failed: [] };

    for (const task of tasks) {
      try {
        const taskId = task._id.toString();
        let changed = false;
        let activityData = null;

        switch (action) {
          case 'set_status': {
            const newStatus = z.enum(TASK_STATUSES).parse(value);
            // Validate workflow transition
            await validateTransition(task.project.toString(), workspaceId, task.status, newStatus);
            if (task.status !== newStatus) {
              activityData = {
                type: 'task.status_changed',
                summary: `Status changed from "${task.status}" to "${newStatus}" (bulk action)`,
                data: { from: task.status, to: newStatus, taskTitle: task.title, bulk: true },
              };
              task.status = newStatus;
              changed = true;
            }
            break;
          }
          case 'set_priority': {
            const newPriority = z.enum(TASK_PRIORITIES).parse(value);
            if (task.priority !== newPriority) {
              task.priority = newPriority;
              changed = true;
              activityData = {
                type: 'task.priority_changed',
                summary: `Priority changed to "${newPriority}" (bulk action)`,
                data: { to: newPriority, taskTitle: task.title, bulk: true },
              };
            }
            break;
          }
          case 'set_assignee': {
            const assigneeId = value || null;
            task.assignee = assigneeId;
            changed = true;
            activityData = {
              type: 'task.assigned',
              summary: assigneeId ? `Assigned (bulk action)` : `Unassigned (bulk action)`,
              data: { to: assigneeId, taskTitle: task.title, bulk: true },
            };
            break;
          }
          case 'add_labels': {
            const labels = z.array(z.string()).parse(value);
            const newLabels = [...new Set([...task.labels, ...labels])];
            if (newLabels.length !== task.labels.length) {
              task.labels = newLabels;
              changed = true;
            }
            break;
          }
          case 'remove_labels': {
            const labels = z.array(z.string()).parse(value);
            const filtered = task.labels.filter((l) => !labels.includes(l));
            if (filtered.length !== task.labels.length) {
              task.labels = filtered;
              changed = true;
            }
            break;
          }
          case 'set_due_date': {
            const date = value ? new Date(z.string().parse(value)) : null;
            if (date && isNaN(date.getTime())) throw new Error('Invalid due date');
            task.dueDate = date;
            changed = true;
            activityData = {
              type: 'task.updated',
              summary: date ? `Due date set to ${date.toISOString().split('T')[0]} (bulk action)` : 'Due date cleared (bulk action)',
              data: { dueDate: date, taskTitle: task.title, bulk: true },
            };
            break;
          }
          case 'delete': {
            await task.deleteOne();
            results.success.push({ taskId, action: 'deleted' });
            continue; // skip save below
          }
        }

        if (changed) {
          await task.save();
          if (activityData) {
            await recordActivity({
              workspace: workspaceId,
              project: task.project,
              task: task._id,
              actor: req.userId,
              ...activityData,
            });
          }
        }
        results.success.push({ taskId, action, changed });
      } catch (err) {
        results.failed.push({ taskId: task._id.toString(), error: err.message });
      }
    }

    const status = results.failed.length === 0 ? 200 : (results.success.length === 0 ? 422 : 207);
    res.status(status).json({ success: results.failed.length === 0, data: results });
  } catch (err) {
    next(err);
  }
};
