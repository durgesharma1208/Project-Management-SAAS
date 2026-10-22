import { Router } from 'express';
import {
  getWorkflows, getWorkflow, createWorkflow, updateWorkflow, deleteWorkflow,
  seedWorkflowTemplates, getProjectWorkflow, createFromTemplate,
} from '../controllers/workflowController.js';
import { protect } from '../middleware/auth.js';
import { requireWorkspaceMember } from '../middleware/workspace.js';

const router = Router({ mergeParams: true });

router.use(protect, requireWorkspaceMember());

// Template seeding (admin only)
router.post('/seed-templates', requireWorkspaceMember('admin'), seedWorkflowTemplates);

// Workflow CRUD
router.get('/', getWorkflows);
router.post('/', requireWorkspaceMember('admin'), createWorkflow);
router.get('/:workflowId', getWorkflow);
router.patch('/:workflowId', requireWorkspaceMember('admin'), updateWorkflow);
router.delete('/:workflowId', requireWorkspaceMember('admin'), deleteWorkflow);

// Create workflow from template
router.post('/:workflowId/create-from-template', requireWorkspaceMember('admin'), createFromTemplate);

export default router;
