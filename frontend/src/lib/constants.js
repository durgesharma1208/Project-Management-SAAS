/**
 * Shared status / priority metadata.
 * Defaults mirror the backend Task model; custom workflows can override the
 * label and colour, but the ids are stable so filtering never breaks.
 */
export const TASK_STATUSES = [
  { id: 'backlog', label: 'Backlog', color: '#94a3b8', chip: 'status-backlog' },
  { id: 'todo', label: 'To Do', color: '#3b82f6', chip: 'status-todo' },
  { id: 'in_progress', label: 'In Progress', color: '#f59e0b', chip: 'status-in_progress' },
  { id: 'in_review', label: 'In Review', color: '#8b5cf6', chip: 'status-in_review' },
  { id: 'done', label: 'Done', color: '#10b981', chip: 'status-done' },
];

export const STATUS_MAP = Object.fromEntries(TASK_STATUSES.map((s) => [s.id, s]));

export const TASK_PRIORITIES = [
  { id: 'urgent', label: 'Urgent', chip: 'priority-urgent', dot: '#ef4444' },
  { id: 'high', label: 'High', chip: 'priority-high', dot: '#f97316' },
  { id: 'medium', label: 'Medium', chip: 'priority-medium', dot: '#eab308' },
  { id: 'low', label: 'Low', chip: 'priority-low', dot: '#0ea5e9' },
  { id: 'none', label: 'No priority', chip: 'priority-none', dot: '#cbd5e1' },
];

export const PRIORITY_MAP = Object.fromEntries(TASK_PRIORITIES.map((p) => [p.id, p]));

export const PROJECT_STATUSES = [
  { id: 'planned', label: 'Planned', chip: 'bg-surface-100 text-surface-600' },
  { id: 'active', label: 'Active', chip: 'bg-emerald-50 text-emerald-700' },
  { id: 'on_hold', label: 'On Hold', chip: 'bg-amber-50 text-amber-700' },
  { id: 'completed', label: 'Completed', chip: 'bg-blue-50 text-blue-700' },
  { id: 'archived', label: 'Archived', chip: 'bg-surface-100 text-surface-400' },
];

export const PROJECT_STATUS_MAP = Object.fromEntries(PROJECT_STATUSES.map((s) => [s.id, s]));

export const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

export const PROJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
];

export const PROJECT_EMOJIS = ['📋', '🚀', '💡', '🎯', '🛠️', '📊', '🌱', '⚡', '🔍', '🎨'];

export const TEAM_EMOJIS = ['👥', '⚙️', '🎨', '📣', '🧪', '📦', '🛟', '🧠'];

/**
 * Merge the built-in status metadata with a project's custom workflow statuses.
 * Returns a consistent { label, color } no matter which source is available.
 */
export const resolveStatusMeta = (statusId, workflowStatuses = []) => {
  const fromWorkflow = workflowStatuses?.find((s) => s.id === statusId);
  if (fromWorkflow) {
    return { id: statusId, label: fromWorkflow.name, color: fromWorkflow.color, chip: '' };
  }
  return STATUS_MAP[statusId] || { id: statusId, label: 'Backlog', color: '#94a3b8', chip: 'status-backlog' };
};

export const resolvePriorityMeta = (priorityId) => PRIORITY_MAP[priorityId] || PRIORITY_MAP.none;
