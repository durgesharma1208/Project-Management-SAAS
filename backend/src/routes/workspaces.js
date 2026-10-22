import { Router } from 'express';
import {
  createWorkspace, getMyWorkspaces, getWorkspace, updateWorkspace,
  getMembers, updateMemberRole, removeMember,
  inviteMember, acceptInvitation, getInvitation,
  getWorkspaceActivity, getInvitations, revokeInvitation,
} from '../controllers/workspaceController.js';
import { protect } from '../middleware/auth.js';
import { requireWorkspaceMember } from '../middleware/workspace.js';

const router = Router();

router.use(protect);

// Public-ish invitation lookup (still needs auth to know who's accepting)
router.get('/invitations/:token', getInvitation);
router.post('/invitations/:token/accept', acceptInvitation);

// Workspace CRUD
router.post('/', createWorkspace);
router.get('/', getMyWorkspaces);
router.get('/:workspaceId', requireWorkspaceMember(), getWorkspace);
router.patch('/:workspaceId', requireWorkspaceMember('admin'), updateWorkspace);

// Activity feed
router.get('/:workspaceId/activity', requireWorkspaceMember(), getWorkspaceActivity);

// Members
router.get('/:workspaceId/members', requireWorkspaceMember(), getMembers);
router.patch('/:workspaceId/members/:memberId', requireWorkspaceMember('admin'), updateMemberRole);
router.delete('/:workspaceId/members/:memberId', requireWorkspaceMember('admin'), removeMember);

// Invitations
router.get('/:workspaceId/invitations', requireWorkspaceMember('admin'), getInvitations);
router.post('/:workspaceId/invitations', requireWorkspaceMember('admin'), inviteMember);
router.delete('/:workspaceId/invitations/:invitationId', requireWorkspaceMember('admin'), revokeInvitation);

export default router;
