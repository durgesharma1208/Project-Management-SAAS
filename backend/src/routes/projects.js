import { Router } from 'express';
import {
  getProjects, getProject, createProject, updateProject, archiveProject, restoreProject,
  deleteProject, getProjectActivity,
} from '../controllers/projectController.js';
import { getProjectDependencyGraph } from '../controllers/dependencyController.js';
import { getCriticalPath } from '../controllers/criticalPathController.js';
import { getProjectWorkflow } from '../controllers/workflowController.js';
import { protect } from '../middleware/auth.js';
import { requireWorkspaceMember } from '../middleware/workspace.js';

const router = Router({ mergeParams: true });

router.use(protect, requireWorkspaceMember());

router.get('/', getProjects);
router.post('/', createProject);
router.get('/:projectId', getProject);
router.patch('/:projectId', updateProject);
router.post('/:projectId/archive', archiveProject);
router.post('/:projectId/restore', restoreProject);
router.delete('/:projectId', deleteProject);
router.get('/:projectId/activity', getProjectActivity);

// Feature 7 — project's effective workflow
router.get('/:projectId/workflow', getProjectWorkflow);

// Feature 9 — dependency graph
router.get('/:projectId/dependency-graph', getProjectDependencyGraph);

// Feature 10 — critical path
router.get('/:projectId/critical-path', getCriticalPath);

export default router;

