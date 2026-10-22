import { Router } from 'express';
import {
  getSavedFilters, createSavedFilter, updateSavedFilter, deleteSavedFilter,
} from '../controllers/savedFilterController.js';
import { protect } from '../middleware/auth.js';
import { requireWorkspaceMember } from '../middleware/workspace.js';

const router = Router({ mergeParams: true });

router.use(protect, requireWorkspaceMember());

router.get('/', getSavedFilters);
router.post('/', createSavedFilter);
router.patch('/:filterId', updateSavedFilter);
router.delete('/:filterId', deleteSavedFilter);

export default router;
