import { AlertTriangle, Inbox } from 'lucide-react';

/** Empty state used across every list/table so nothing looks broken when empty. */
export const EmptyState = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
  className = '',
}) => (
  <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-10 px-4' : 'py-16 px-6'} ${className}`}>
    <div className="w-11 h-11 rounded-xl bg-surface-100 flex items-center justify-center mb-3">
      <Icon size={20} className="text-surface-400" />
    </div>
    <h3 className="text-sm font-semibold text-surface-800">{title}</h3>
    {description && <p className="text-xs text-surface-500 mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorState = ({ message = 'Something went wrong while loading this view.', onRetry, className = '' }) => (
  <div className={`flex flex-col items-center justify-center text-center py-14 px-6 ${className}`}>
    <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center mb-3">
      <AlertTriangle size={20} className="text-red-500" />
    </div>
    <h3 className="text-sm font-semibold text-surface-800">Unable to load</h3>
    <p className="text-xs text-surface-500 mt-1 max-w-sm">{message}</p>
    {onRetry && (
      <button type="button" className="btn-secondary btn-sm mt-4" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);

export const Skeleton = ({ className = '' }) => <div className={`skeleton ${className}`} aria-hidden="true" />;

export const SkeletonText = ({ lines = 3, className = '' }) => (
  <div className={`space-y-2 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="skeleton h-3" style={{ width: `${90 - i * 12}%` }} />
    ))}
  </div>
);

export const PageSkeleton = ({ cards = 3 }) => (
  <div className="page space-y-6" aria-busy="true" aria-live="polite">
    <div className="space-y-2">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-3 w-72" />
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card p-4 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-12" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="card p-5 lg:col-span-2 space-y-4">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-2.5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
      <div className="card p-5 space-y-3">
        <Skeleton className="h-4 w-24" />
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  </div>
);

export const ProgressBar = ({ value = 0, color = '#6366f1', className = '', label }) => {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`h-1.5 w-full bg-surface-100 rounded-full overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Progress'}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  );
};

export const SegmentedControl = ({ value, onChange, options, size = 'md', className = '' }) => (
  <div
    className={`inline-flex items-center gap-0.5 bg-surface-100 p-0.5 rounded-lg ${className}`}
    role="tablist"
  >
    {options.map((option) => {
      const Icon = option.icon;
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(option.value)}
          className={`inline-flex items-center gap-1.5 rounded-md font-medium transition-colors
            ${size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-[13px]'}
            ${active ? 'bg-white text-surface-900 shadow-subtle' : 'text-surface-500 hover:text-surface-800'}`}
        >
          {Icon && <Icon size={13} />}
          {option.label}
        </button>
      );
    })}
  </div>
);

export const PageHeader = ({ title, description, actions, breadcrumb, children, className = '' }) => (
  <div className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5 ${className}`}>
    <div className="min-w-0">
      {breadcrumb}
      <h1 className="text-[19px] font-semibold text-surface-900 leading-tight truncate">{title}</h1>
      {description && <p className="text-[13px] text-surface-500 mt-0.5">{description}</p>}
      {children}
    </div>
    {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
  </div>
);

export const StatCard = ({ label, value, icon: Icon, hint, tone = 'default' }) => {
  const tones = {
    default: 'bg-surface-100 text-surface-500',
    primary: 'bg-primary-50 text-primary-600',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-600',
  };
  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-surface-500">{label}</p>
        {Icon && (
          <span className={`w-6 h-6 rounded-md flex items-center justify-center ${tones[tone]}`}>
            <Icon size={13} />
          </span>
        )}
      </div>
      <p className="text-[22px] leading-7 font-semibold text-surface-900 mt-1.5 tabular-nums">{value}</p>
      {hint && <p className="text-2xs text-surface-400 mt-0.5">{hint}</p>}
    </div>
  );
};
