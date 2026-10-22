/**
 * Saved Filter Controller
 * Routes: /api/workspaces/:workspaceId/saved-filters
 */
import { z } from 'zod';
import SavedFilter from '../models/SavedFilter.js';
import { createError } from '../middleware/errorHandler.js';

const ALLOWED_SORT_FIELDS = ['title', 'status', 'priority', 'dueDate', 'startDate', 'updatedAt', 'createdAt', 'estimatedHours'];

const filtersSchema = z.object({
  status: z.array(z.string()).optional(),
  priority: z.array(z.string()).optional(),
  assignee: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  overdue: z.boolean().optional(),
  dueBefore: z.string().optional().nullable(),
  dueAfter: z.string().optional().nullable(),
  search: z.string().optional(),
}).optional();

const savedFilterCreateSchema = z.object({
  name: z.string().min(1).max(100),
  project: z.string().optional().nullable(),
  filters: filtersSchema,
  sortField: z.enum(ALLOWED_SORT_FIELDS).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  viewPrefs: z.record(z.unknown()).optional(),
});

// ── List saved filters ─────────────────────────────────────────────────────────
export const getSavedFilters = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { project } = req.query;

    const query = { workspace: workspaceId, user: req.userId };
    if (project) query.project = project;

    const filters = await SavedFilter.find(query).sort({ updatedAt: -1 });
    res.json({ success: true, data: { filters } });
  } catch (err) {
    next(err);
  }
};

// ── Create saved filter ────────────────────────────────────────────────────────
export const createSavedFilter = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const data = savedFilterCreateSchema.parse(req.body);

    const filter = await SavedFilter.create({
      workspace: workspaceId,
      user: req.userId,
      project: data.project || null,
      name: data.name,
      filters: data.filters || {},
      sortField: data.sortField || 'createdAt',
      sortDir: data.sortDir || 'desc',
      viewPrefs: data.viewPrefs || {},
    });

    res.status(201).json({ success: true, data: { filter } });
  } catch (err) {
    next(err);
  }
};

// ── Update (rename/edit) saved filter ─────────────────────────────────────────
export const updateSavedFilter = async (req, res, next) => {
  try {
    const { workspaceId, filterId } = req.params;
    const data = savedFilterCreateSchema.partial().parse(req.body);

    const filter = await SavedFilter.findOneAndUpdate(
      { _id: filterId, workspace: workspaceId, user: req.userId },
      { $set: data },
      { new: true, runValidators: true }
    );
    if (!filter) throw createError('Saved filter not found', 404);

    res.json({ success: true, data: { filter } });
  } catch (err) {
    next(err);
  }
};

// ── Delete saved filter ────────────────────────────────────────────────────────
export const deleteSavedFilter = async (req, res, next) => {
  try {
    const { workspaceId, filterId } = req.params;
    const filter = await SavedFilter.findOneAndDelete({ _id: filterId, workspace: workspaceId, user: req.userId });
    if (!filter) throw createError('Saved filter not found', 404);
    res.json({ success: true, message: 'Saved filter deleted' });
  } catch (err) {
    next(err);
  }
};
