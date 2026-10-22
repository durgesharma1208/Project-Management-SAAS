import { useState } from 'react';
import { Search, Bell, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';

export const TopNav = ({ title, breadcrumbs }) => {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  return (
    <header className="h-12 flex items-center gap-3 px-4 bg-white border-b border-surface-200 sticky top-0 z-20">
      {/* Breadcrumbs / Title */}
      <div className="flex-1 min-w-0">
        {breadcrumbs ? (
          <nav className="flex items-center gap-1.5 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-surface-300">/</span>}
                {crumb.href ? (
                  <button onClick={() => navigate(crumb.href)} className="text-surface-500 hover:text-surface-900 transition-colors">
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-surface-900 font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : (
          <h1 className="text-sm font-semibold text-surface-900 truncate">{title}</h1>
        )}
      </div>

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 w-56 text-sm">
        <Search size={13} className="text-surface-400 flex-shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="bg-transparent outline-none text-surface-700 placeholder:text-surface-400 w-full text-xs"
        />
      </div>

      {/* Notifications */}
      <button className="btn-ghost p-2 rounded-lg relative">
        <Bell size={16} />
      </button>

      {/* Profile */}
      <button onClick={() => navigate('/profile')} className="flex items-center gap-2">
        <Avatar user={user} size="xs" />
      </button>
    </header>
  );
};
