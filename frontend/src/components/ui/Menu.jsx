import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Small popover primitive used by menus, notifications and the profile menu.
 * Handles outside clicks, Escape and accessible open state.
 */
export const Popover = ({
  trigger,
  children,
  align = 'right',
  className = '',
  panelClassName = '',
  width = 'w-60',
}) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {trigger({ open, toggle: () => setOpen((v) => !v), close: () => setOpen(false) })}
      {open && (
        <div
          className={`dropdown absolute top-full mt-1.5 ${align === 'right' ? 'right-0' : 'left-0'} ${width} ${panelClassName}`}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
};

export const MenuItem = ({ icon: Icon, children, onClick, danger = false, disabled = false, shortcut }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`dropdown-item ${danger ? 'dropdown-item-danger' : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
  >
    {Icon && <Icon size={14} className={danger ? 'text-red-500' : 'text-surface-400'} />}
    <span className="flex-1">{children}</span>
    {shortcut && <span className="kbd">{shortcut}</span>}
  </button>
);

/**
 * A compact select-style trigger for filters inside toolbars.
 */
export const FilterSelect = ({ value, onChange, options, label, className = '' }) => (
  <label className={`relative inline-flex items-center ${className}`}>
    {label && <span className="sr-only">{label}</span>}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none bg-white border border-surface-200 rounded-lg pl-2.5 pr-7 py-1.5 text-xs font-medium
                 text-surface-700 shadow-subtle hover:border-surface-300 cursor-pointer
                 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
    <ChevronDown size={12} className="pointer-events-none absolute right-2 text-surface-400" />
  </label>
);

export default Popover;
