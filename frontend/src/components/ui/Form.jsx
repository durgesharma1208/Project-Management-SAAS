import { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * FormField wraps a label, control and validation message.
 * Pass `id` and the same id on the control for an explicit label association.
 */
export const FormField = ({ label, error, hint, required, children, id, className = '' }) => (
  <div className={`space-y-1.5 ${className}`}>
    {label && (
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
      </label>
    )}
    {children}
    {hint && !error && <p className="hint">{hint}</p>}
    {error && (
      <p className="flex items-center gap-1 text-xs text-red-600" role="alert">
        <AlertCircle size={12} className="flex-shrink-0" />
        {error}
      </p>
    )}
  </div>
);

export const Input = forwardRef(({ error, className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`input ${error ? 'input-error' : ''} ${className}`}
    aria-invalid={error ? 'true' : undefined}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = forwardRef(({ error, className = '', rows = 4, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={`input resize-y ${error ? 'input-error' : ''} ${className}`}
    aria-invalid={error ? 'true' : undefined}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef(({ error, className = '', children, ...props }, ref) => (
  <select
    ref={ref}
    className={`input pr-8 cursor-pointer ${error ? 'input-error' : ''} ${className}`}
    aria-invalid={error ? 'true' : undefined}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export const Checkbox = forwardRef(({ label, id, className = '', ...props }, ref) => (
  <label htmlFor={id} className={`flex items-center gap-2 text-[13px] text-surface-700 cursor-pointer ${className}`}>
    <input
      ref={ref}
      id={id}
      type="checkbox"
      className="w-3.5 h-3.5 rounded border-surface-300 text-primary-600 focus:ring-primary-500/40"
      {...props}
    />
    {label}
  </label>
));
Checkbox.displayName = 'Checkbox';
