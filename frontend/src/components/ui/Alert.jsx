import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

const styles = {
  success: { Icon: CheckCircle2, wrap: 'bg-emerald-50 border-emerald-200 text-emerald-800', iconClass: 'text-emerald-500' },
  error: { Icon: AlertCircle, wrap: 'bg-red-50 border-red-200 text-red-800', iconClass: 'text-red-500' },
  warning: { Icon: AlertTriangle, wrap: 'bg-amber-50 border-amber-200 text-amber-900', iconClass: 'text-amber-500' },
  info: { Icon: Info, wrap: 'bg-primary-50 border-primary-200 text-primary-900', iconClass: 'text-primary-500' },
};

export const Alert = ({ type = 'info', message, children, dismissible = false, onDismiss, className = '' }) => {
  const [dismissedKey, setDismissedKey] = useState(null);
  const content = message || children;
  // Remember *which* message was dismissed so a new message shows up again.
  const contentKey = content ? `${type}:${typeof content === 'string' ? content : 'node'}` : null;
  const dismissed = contentKey !== null && dismissedKey === contentKey;

  if (!content || dismissed) return null;
  const config = styles[type] || styles.info;
  const Icon = config.Icon;

  const handleDismiss = () => {
    setDismissedKey(contentKey);
    onDismiss?.();
  };

  return (
    <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-[13px] animate-fade-in ${config.wrap} ${className}`} role="alert">
      <Icon size={15} className={`flex-shrink-0 mt-0.5 ${config.iconClass}`} aria-hidden="true" />
      <div className="flex-1">{content}</div>
      {dismissible && (
        <button type="button" onClick={handleDismiss} className="flex-shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss message">
          <X size={13} />
        </button>
      )}
    </div>
  );
};

export const extractError = (error) => {
  if (!error) return null;
  if (typeof error === 'string') return error;
  return (
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0]?.message ||
    error?.message ||
    'Something went wrong'
  );
};

export default Alert;
