import { useCallback, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const SIZE_MAP = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * Accessible modal dialog: Escape to close, focus moved into the panel,
 * Tab cycling contained, background scroll locked.
 */
export const Dialog = ({ isOpen, onClose, title, description, children, size = 'md', footer }) => {
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose?.();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    const timer = setTimeout(() => {
      const target = panelRef.current?.querySelector(
        'input:not([type="hidden"]), textarea, select, button[data-autofocus], [data-autofocus]',
      );
      target?.focus?.();
    }, 30);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      clearTimeout(timer);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus?.();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <>
      <div className="dialog-overlay" onClick={onClose} aria-hidden="true" />
      <div className="dialog">
        <div
          ref={panelRef}
          className={`dialog-panel ${SIZE_MAP[size] || SIZE_MAP.md}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
        >
          <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-surface-200 flex-shrink-0">
            <div className="min-w-0">
              {title && <h2 id={titleId} className="text-[15px] font-semibold text-surface-900">{title}</h2>}
              {description && <p id={descId} className="text-xs text-surface-500 mt-0.5">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="btn-icon -mr-1 -mt-1" aria-label="Close dialog">
              <X size={16} />
            </button>
          </div>

          <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>

          {footer && (
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-surface-200 bg-surface-50/60 rounded-b-2xl flex-shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Dialog;
