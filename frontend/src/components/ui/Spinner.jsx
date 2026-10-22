import { Loader2 } from 'lucide-react';

export const Spinner = ({ size = 16, className = '' }) => (
  <Loader2 size={size} className={`animate-spin ${className}`} />
);

export const PageLoader = () => (
  <div className="flex flex-col items-center justify-center h-64 gap-3">
    <Spinner size={32} className="text-primary-500" />
    <p className="text-sm text-surface-500">Loading…</p>
  </div>
);

export const FullPageLoader = () => (
  <div className="fixed inset-0 bg-surface-50 flex flex-col items-center justify-center gap-4 z-50">
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-sm">T</span>
      </div>
      <span className="text-lg font-semibold text-surface-800">TaskFlow</span>
    </div>
    <Spinner size={24} className="text-primary-500" />
  </div>
);
