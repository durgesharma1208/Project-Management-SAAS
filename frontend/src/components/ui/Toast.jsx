import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

/**
 * Lightweight toast notifications.
 * Every mutating action in TaskFlow reports success/failure through this so the
 * user is never left guessing whether a request worked.
 */
const ToastContext = createContext(null);

const VARIANTS = {
  success: { icon: CheckCircle2, iconClass: 'text-emerald-500', bar: 'bg-emerald-500' },
  error: { icon: AlertCircle, iconClass: 'text-red-500', bar: 'bg-red-500' },
  info: { icon: Info, iconClass: 'text-primary-500', bar: 'bg-primary-500' },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback((message, options = {}) => {
    if (!message) return null;
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const type = options.type || 'success';
    setToasts((prev) => [...prev.slice(-3), { id, message, type, title: options.title }]);
    const timer = setTimeout(() => dismiss(id), options.duration ?? 4200);
    timers.current.set(id, timer);
    return id;
  }, [dismiss]);

  useEffect(() => () => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
  }, []);

  const api = useMemo(() => ({
    toast,
    dismiss,
    success: (message, options) => toast(message, { ...options, type: 'success' }),
    error: (message, options) => toast(message, { ...options, type: 'error', duration: 6000 }),
    info: (message, options) => toast(message, { ...options, type: 'info' }),
  }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed z-[60] bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 items-stretch sm:items-end pointer-events-none"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => {
          const variant = VARIANTS[t.type] || VARIANTS.info;
          const Icon = variant.icon;
          return (
            <div
              key={t.id}
              role="status"
              aria-live="polite"
              className="pointer-events-auto flex items-start gap-3 bg-surface-900 text-white rounded-xl shadow-dialog px-4 py-3 w-full sm:w-[360px] animate-slide-up"
            >
              <Icon size={17} className={`mt-0.5 flex-shrink-0 ${variant.iconClass}`} />
              <div className="flex-1 min-w-0">
                {t.title && <p className="text-[13px] font-semibold">{t.title}</p>}
                <p className="text-[13px] text-surface-200 break-words">{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="text-surface-400 hover:text-white transition-colors"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};
