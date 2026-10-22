/**
 * Task query helpers.
 *
 * These functions translate HTTP query strings into a MongoDB filter and sort
 * configuration. Keeping them in one place means the List view, My Tasks,
 * global search and bulk actions all interpret filters identically, and the
 * logic can be unit tested without a database.
 */
import mongoose from 'mongoose';

export const TASK_SORT_FIELDS = [
  'position',
  'createdAt',
  'updatedAt',
  'dueDate',
  'startDate',
  'title',
  'status',
  'priority',
];

export const STATUS_ORDER = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];
export const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low', 'none'];

/** Escape a user supplied string so it can be used inside a RegExp safely. */
export const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Accepts `?status=todo&status=done`, `?status=todo,done` or `?status[]=todo`.
 * Returns a clean, de-duplicated array of non-empty strings.
 */
export const toArray = (value) => {
  if (value === undefined || value === null || value === '') return [];
  const raw = Array.isArray(value) ? value : String(value).split(',');
  return [...new Set(raw.map((v) => String(v).trim()).filter(Boolean))];
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

/**
 * Build a MongoDB filter for the task list endpoint.
 *
 * @param {object} params
 * @param {string} params.workspaceId
 * @param {string} params.userId        - authenticated user (for "me" / myTasks)
 * @param {object} params.query         - req.query
 * @returns {object} mongoose filter
 */
export const buildTaskFilter = ({ workspaceId, userId, query = {} }) => {
  const filter = { workspace: workspaceId };
  const {
    project, projectId, status, priority, assignee, label, labels,
    search, overdue, dueBefore, dueAfter, unassigned, myTasks, includeDone,
  } = query;

  const projectValue = project || projectId;
  if (projectValue) filter.project = projectValue;

  const statuses = toArray(status);
  if (statuses.length === 1) filter.status = statuses[0];
  else if (statuses.length > 1) filter.status = { $in: statuses };

  const priorities = toArray(priority);
  if (priorities.length === 1) filter.priority = priorities[0];
  else if (priorities.length > 1) filter.priority = { $in: priorities };

  const labelList = toArray(labels || label);
  if (labelList.length === 1) filter.labels = labelList[0];
  else if (labelList.length > 1) filter.labels = { $all: labelList };

  const assignees = toArray(assignee);
  if (unassigned === 'true') {
    filter.assignee = null;
  } else if (assignees.includes('me') || myTasks === 'true') {
    filter.assignee = userId;
  } else if (assignees.length === 1) {
    filter.assignee = assignees[0];
  } else if (assignees.length > 1) {
    filter.assignee = { $in: assignees };
  }

  if (overdue === 'true') {
    filter.status = statuses.length === 1
      ? statuses[0]
      : statuses.length > 1
        ? { $in: statuses }
        : { $ne: 'done' };
    filter.dueDate = { ...(filter.dueDate || {}), $lt: new Date() };
  }

  if (includeDone === 'false') {
    filter.status = statuses.length ? (statuses.length === 1 ? statuses[0] : { $in: statuses }) : { $ne: 'done' };
  }

  const dateRange = {};
  if (dueAfter) {
    const d = new Date(dueAfter);
    if (!Number.isNaN(d.getTime())) dateRange.$gte = d;
  }
  if (dueBefore) {
    const d = new Date(dueBefore);
    if (!Number.isNaN(d.getTime())) dateRange.$lte = d;
  }
  if (Object.keys(dateRange).length) {
    filter.dueDate = { ...(filter.dueDate || {}), ...dateRange };
  }

  if (search && String(search).trim()) {
    const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { labels: rx }];
  }

  return filter;
};

/**
 * Build a sort clause. Only whitelisted fields are accepted so a user cannot
 * inject arbitrary keys or trigger full-collection scans.
 */
export const buildTaskSort = ({ sort, dir } = {}) => {
  const field = TASK_SORT_FIELDS.includes(sort) ? sort : 'manual';
  const direction = dir === 'asc' ? 1 : dir === 'desc' ? -1 : null;

  if (field === 'priority') return { priority: direction ?? 1 };
  if (field === 'status') return { status: direction ?? 1 };
  if (field === 'title') return { title: direction ?? 1 };
  if (field === 'dueDate') return { dueDate: direction ?? 1, createdAt: -1 };
  if (field === 'startDate') return { startDate: direction ?? 1, createdAt: -1 };
  if (field === 'createdAt') return { createdAt: direction ?? -1 };
  if (field === 'updatedAt') return { updatedAt: direction ?? -1 };

  // Default: manual board order, then newest first
  return { position: 1, createdAt: -1 };
};

/**
 * Priority sorting needs a custom order (urgent → none) which MongoDB cannot
 * express on the string field itself. This helper returns the ranking used by
 * the aggregation pipeline (and by tests).
 */
export const priorityRankExpression = {
  $switch: {
    branches: PRIORITY_ORDER.map((value, index) => ({
      case: { $eq: ['$priority', value] },
      then: index,
    })),
    default: PRIORITY_ORDER.length,
  },
};

export const buildPagination = ({ page, limit } = {}, { defaultLimit = 50, maxLimit = 200 } = {}) => {
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || defaultLimit));
  return { page: pageNumber, limit: perPage, skip: (pageNumber - 1) * perPage };
};
