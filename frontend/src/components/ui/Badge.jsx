import { resolvePriorityMeta, resolveStatusMeta, PROJECT_STATUS_MAP } from '../../lib/constants';

/** Coloured dot + label used for task statuses everywhere. */
export const StatusBadge = ({ status = 'backlog', showLabel = true, workflowStatuses = [], className = '' }) => {
  const meta = resolveStatusMeta(status, workflowStatuses);
  if (meta.chip) {
    return (
      <span className={`badge ${meta.chip} ${className}`}>
        <span className="status-dot" style={{ backgroundColor: meta.color }} aria-hidden="true" />
        {showLabel && meta.label}
      </span>
    );
  }
  return (
    <span
      className={`badge ${className}`}
      style={{ backgroundColor: `${meta.color}14`, color: meta.color }}
    >
      <span className="status-dot" style={{ backgroundColor: meta.color }} aria-hidden="true" />
      {showLabel && meta.label}
    </span>
  );
};

export const PriorityBadge = ({ priority = 'none', showLabel = true, className = '' }) => {
  const meta = resolvePriorityMeta(priority);
  return (
    <span className={`badge ${meta.chip} ${className}`} title={`Priority: ${meta.label}`}>
      <span className="status-dot" style={{ backgroundColor: meta.dot }} aria-hidden="true" />
      {showLabel && meta.label}
    </span>
  );
};

export const ProjectStatusBadge = ({ status = 'planned', className = '' }) => {
  const meta = PROJECT_STATUS_MAP[status] || PROJECT_STATUS_MAP.planned;
  return <span className={`badge ${meta.chip} ${className}`}>{meta.label}</span>;
};

export const LabelBadge = ({ label }) => (
  <span className="badge bg-surface-100 text-surface-600 border border-surface-200 font-normal">
    {label}
  </span>
);

export const CountBadge = ({ count, tone = 'default' }) => {
  const tones = {
    default: 'bg-surface-100 text-surface-600',
    primary: 'bg-primary-50 text-primary-700',
    danger: 'bg-red-50 text-red-600',
  };
  return <span className={`badge ${tones[tone]}`}>{count}</span>;
};

export default StatusBadge;
