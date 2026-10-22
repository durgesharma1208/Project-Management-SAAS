import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible modal dialog.
 * Props: isOpen, onClose, title, children, size ('sm'|'md'|'lg'|'xl'), footer
 */
export const Dialog = ({ isOpen, onClose, title, children, size = 'md', footer }) => {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeMap = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <>
      <div className="dialog-overlay" onClick={onClose} aria-hidden="true" />
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div ref={panelRef} className={`dialog-panel w-full ${sizeMap[size]}`} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          {(title || onClose) && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
              {title && <h2 id="dialog-title" className="text-base font-semibold text-surface-900">{title}</h2>}
              <button
                onClick={onClose}
                className="btn-ghost p-1.5 rounded-lg ml-auto"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {/* Body */}
          <div className="px-6 py-5">{children}</div>
          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-surface-100">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Dialog;
