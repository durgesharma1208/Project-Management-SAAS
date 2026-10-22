import { forwardRef } from 'react';

/**
 * FormField — wraps label + input + error message.
 * Props: label, error, hint, required, children
 */
export const FormField = ({ label, error, hint, required, children, id }) => (
  <div className="space-y-1.5">
    {label && (
      <label htmlFor={id} className="label">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    )}
    {children}
    {hint && !error && <p className="text-xs text-surface-500">{hint}</p>}
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
);

/**
 * Input — styled text input with error state support.
 */
export const Input = forwardRef(({ error, className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`input ${error ? 'input-error' : ''} ${className}`}
    {...props}
  />
));
Input.displayName = 'Input';

/**
 * Textarea
 */
export const Textarea = forwardRef(({ error, className = '', rows = 4, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={`input resize-none ${error ? 'input-error' : ''} ${className}`}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

/**
 * Select
 */
export const Select = forwardRef(({ error, className = '', children, ...props }, ref) => (
  <select
    ref={ref}
    className={`input ${error ? 'input-error' : ''} ${className}`}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';
