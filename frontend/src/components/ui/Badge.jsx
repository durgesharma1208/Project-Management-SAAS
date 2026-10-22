import { Flag, AlertCircle } from 'lucide-react';

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', cls: 'priority-urgent', dot: 'bg-red-500' },
  high:   { label: 'High',   cls: 'priority-high',   dot: 'bg-orange-500' },
  medium: { label: 'Medium', cls: 'priority-medium',  dot: 'bg-yellow-500' },
  low:    { label: 'Low',    cls: 'priority-low',     dot: 'bg-blue-400' },
  none:   { label: 'None',   cls: 'priority-none',    dot: 'bg-surface-300' },
};

const STATUS_CONFIG = {
  backlog:     { label: 'Backlog',     cls: 'status-backlog',     dot: 'bg-surface-400' },
  todo:        { label: 'Todo',        cls: 'status-todo',        dot: 'bg-blue-500' },
  in_progress: { label: 'In Progress', cls: 'status-in_progress', dot: 'bg-amber-500' },
  in_review:   { label: 'In Review',  cls: 'status-in_review',   dot: 'bg-purple-500' },
  done:        { label: 'Done',        cls: 'status-done',        dot: 'bg-green-500' },
};

const PROJECT_STATUS_CONFIG = {
  planned:   { label: 'Planned',   cls: 'bg-surface-100 text-surface-600' },
  active:    { label: 'Active',    cls: 'bg-green-50 text-green-700' },
  on_hold:   { label: 'On Hold',   cls: 'bg-amber-50 text-amber-700' },
  completed: { label: 'Completed', cls: 'bg-blue-50 text-blue-700' },
  archived:  { label: 'Archived',  cls: 'bg-surface-100 text-surface-400' },
};

export const PriorityBadge = ({ priority = 'none', showLabel = true }) => {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.none;
  return (
    <span className={`badge ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {showLabel && cfg.label}
    </span>
  );
};

export const StatusBadge = ({ status = 'backlog', showLabel = true }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.backlog;
  return (
    <span className={`badge ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {showLabel && cfg.label}
    </span>
  );
};

export const ProjectStatusBadge = ({ status = 'planned' }) => {
  const cfg = PROJECT_STATUS_CONFIG[status] || PROJECT_STATUS_CONFIG.planned;
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
};

export const LabelBadge = ({ label }) => (
  <span className="badge bg-primary-50 text-primary-700 border border-primary-100">{label}</span>
);

export { PRIORITY_CONFIG, STATUS_CONFIG, PROJECT_STATUS_CONFIG };
