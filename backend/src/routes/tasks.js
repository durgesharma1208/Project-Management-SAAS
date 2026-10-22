import { Router } from 'express';
import {
  getTasks, getTask, createTask, updateTask, moveTask, deleteTask,
  getTaskActivity, addSubtask, toggleSubtask,
  getComments, addComment, updateComment, deleteComment,
  getDashboard, getCalendarTasks, scheduleTask,
} from '../controllers/taskController.js';
import { bulkUpdateTasks } from '../controllers/bulkController.js';
import {
  getTaskDependencies, addDependency, removeDependency,
} from '../controllers/dependencyController.js';
import { protect } from '../middleware/auth.js';
import { requireWorkspaceMember } from '../middleware/workspace.js';

const router = Router({ mergeParams: true });

router.use(protect, requireWorkspaceMember());

router.get('/dashboard', getDashboard);
router.get('/calendar', getCalendarTasks);          // Feature 8
router.post('/bulk', bulkUpdateTasks);              // Feature 6

router.get('/', getTasks);
router.post('/', createTask);
router.get('/:taskId', getTask);
router.patch('/:taskId', updateTask);
router.post('/:taskId/move', moveTask);
router.patch('/:taskId/schedule', scheduleTask);    // Feature 8
router.delete('/:taskId', deleteTask);
router.get('/:taskId/activity', getTaskActivity);

// Subtasks
router.post('/:taskId/subtasks', addSubtask);
router.patch('/:taskId/subtasks/:subtaskId/toggle', toggleSubtask);

// Comments
router.get('/:taskId/comments', getComments);
router.post('/:taskId/comments', addComment);
router.patch('/comments/:commentId', updateComment);
router.delete('/comments/:commentId', deleteComment);

// Dependencies (Feature 9)
router.get('/:taskId/dependencies', getTaskDependencies);
router.post('/:taskId/dependencies', addDependency);
router.delete('/:taskId/dependencies/:dependencyId', removeDependency);

export default router;

