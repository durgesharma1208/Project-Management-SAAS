import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};
const colors = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};
const iconColors = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

export const Alert = ({ type = 'info', message, dismissible = false, onDismiss }) => {
  const [dismissed, setDismissed] = useState(false);
  if (!message || dismissed) return null;
  const Icon = icons[type];

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl border text-sm animate-fade-in ${colors[type]}`}>
      <Icon size={16} className={`flex-shrink-0 mt-0.5 ${iconColors[type]}`} />
      <span className="flex-1">{message}</span>
      {dismissible && (
        <button onClick={handleDismiss} className="flex-shrink-0 opacity-60 hover:opacity-100">
          <X size={14} />
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
