import { Router } from 'express';
import {
  getTeams, getTeam, createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember,
} from '../controllers/teamController.js';
import { protect } from '../middleware/auth.js';
import { requireWorkspaceMember } from '../middleware/workspace.js';

const router = Router({ mergeParams: true });

router.use(protect, requireWorkspaceMember());

router.get('/', getTeams);
router.post('/', createTeam);
router.get('/:teamId', getTeam);
router.patch('/:teamId', updateTeam);
router.delete('/:teamId', deleteTeam);
router.post('/:teamId/members', addTeamMember);
router.delete('/:teamId/members/:memberId', removeTeamMember);

export default router;
