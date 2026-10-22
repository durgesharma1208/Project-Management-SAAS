import { AlertTriangle } from 'lucide-react';
import { Dialog } from './Dialog';
import { Spinner } from './Spinner';

/** Shared destructive-action confirmation. */
export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  isPending = false,
}) => (
  <Dialog
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    size="sm"
    footer={
      <>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={isPending}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={danger ? 'btn-danger' : 'btn-primary'}
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending && <Spinner size={13} />}
          {confirmLabel}
        </button>
      </>
    }
  >
    <div className="flex gap-3">
      {danger && (
        <span className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={17} className="text-red-500" />
        </span>
      )}
      <p className="text-[13px] text-surface-600 leading-relaxed">{message}</p>
    </div>
  </Dialog>
);

export default ConfirmDialog;
