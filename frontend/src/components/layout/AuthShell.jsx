import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { AuroraBackground } from './AuroraBackground';

/**
 * Shared chrome for every unauthenticated screen (sign in, sign up, password
 * reset, invitation). Keeping it in one place means the aurora, the brand mark
 * and the glass card stay identical across the five pages.
 */
export const AuthShell = ({ children, width = 'max-w-md', cardClassName = '', footer, brand = true }) => (
  <div className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-surface-50">
    <AuroraBackground />

    <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-12">
      {brand && (
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2.5 rounded-lg no-tap-highlight"
          aria-label="TaskFlow home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 shadow-elevated ring-1 ring-white/40">
            <Zap size={17} className="text-white" aria-hidden="true" />
          </span>
          <span className="text-[19px] font-semibold tracking-[-0.02em] text-surface-900">TaskFlow</span>
        </Link>
      )}

      <div className={`glass-card w-full ${width} p-6 sm:p-8 animate-slide-up ${cardClassName}`}>
        {children}
      </div>

      {footer && <div className="mt-5 text-center text-xs text-surface-500">{footer}</div>}
    </main>

    <p className="relative z-10 pb-6 text-center text-2xs text-surface-500">
      TaskFlow — project management for focused teams
    </p>
  </div>
);

export default AuthShell;
