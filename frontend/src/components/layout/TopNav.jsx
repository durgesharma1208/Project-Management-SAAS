import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Menu, Search, Bell, Plus, CheckSquare, FolderPlus, Sparkles,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Popover, MenuItem } from '../ui/Menu';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { workspacesApi, workspaceKeys } from '../../lib/taskApi';
import { relativeTime } from '../../lib/format';
import { CommandPalette } from './CommandPalette';

const SECTION_LABELS = [
  { match: /^\/dashboard/, label: 'Overview' },
  { match: /^\/my-tasks/, label: 'My Tasks' },
  { match: /^\/tasks\/list/, label: 'All Tasks' },
  { match: /^\/tasks/, label: 'All Tasks' },
  { match: /^\/projects\/[^/]+\/board/, label: 'Board' },
  { match: /^\/projects\/[^/]+\/calendar/, label: 'Calendar' },
  { match: /^\/projects\/[^/]+\/gantt/, label: 'Gantt' },
  { match: /^\/projects\/[^/]+\/dependencies/, label: 'Dependencies' },
  { match: /^\/projects\/[^/]+\/critical-path/, label: 'Critical Path' },
  { match: /^\/projects\/[^/]+/, label: 'Project' },
  { match: /^\/projects/, label: 'Projects' },
  { match: /^\/workflows/, label: 'Workflows' },
  { match: /^\/teams/, label: 'Teams' },
  { match: /^\/settings/, label: 'Settings' },
  { match: /^\/profile/, label: 'Profile' },
];

// Read the clock outside render so the component stays pure.
const nowMs = () => Date.now();

export const TopNav = ({ onOpenSidebar }) => {
  const { user } = useAuth();
  const { activeWorkspace, activeWorkspaceId } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const section = SECTION_LABELS.find((s) => s.match.test(location.pathname))?.label || 'Overview';

  const { data: activities = [] } = useQuery({
    queryKey: workspaceKeys.activity(activeWorkspaceId),
    queryFn: () => workspacesApi.activity(activeWorkspaceId, { limit: 12 }),
    enabled: Boolean(activeWorkspaceId),
    staleTime: 30_000,
  });

  const lastSeen = Number(localStorage.getItem('notificationsSeenAt') || 0);
  const unreadCount = useMemo(
    () => activities.filter((a) => new Date(a.createdAt).getTime() > lastSeen).length,
    [activities, lastSeen],
  );

  const markSeen = () => {
    localStorage.setItem('notificationsSeenAt', String(nowMs()));
  };

  return (
    <>
      <header className="h-14 flex items-center gap-2 px-3 sm:px-5 bg-white border-b border-surface-200 flex-shrink-0 z-20">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="btn-icon lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="hidden sm:inline text-[13px] text-surface-400 truncate max-w-[160px]">
            {activeWorkspace?.name}
          </span>
          <span className="hidden sm:inline text-surface-300">/</span>
          <span className="text-[13px] font-medium text-surface-800 truncate">{section}</span>
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="hidden md:flex items-center gap-2 w-56 lg:w-64 px-2.5 py-1.5 rounded-lg border border-surface-200
                     bg-surface-50 hover:bg-white hover:border-surface-300 transition-colors text-left"
        >
          <Search size={14} className="text-surface-400" />
          <span className="flex-1 text-xs text-surface-400">Search…</span>
          <span className="kbd">⌘K</span>
        </button>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="btn-icon md:hidden"
          aria-label="Search"
        >
          <Search size={17} />
        </button>

        <Popover
          width="w-[280px]"
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              className="btn-icon relative"
              aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
              aria-expanded={open}
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary-600 ring-2 ring-white" />
              )}
            </button>
          )}
        >
          {({ close }) => (
            <div>
              <div className="flex items-center justify-between px-3 py-2 border-b border-surface-100">
                <p className="text-xs font-semibold text-surface-800">Activity</p>
                <button
                  type="button"
                  className="text-2xs text-primary-600 hover:underline"
                  onClick={() => { markSeen(); close(); }}
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {activities.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-surface-500">
                    No activity in this workspace yet.
                  </p>
                ) : (
                  activities.slice(0, 8).map((activity) => (
                    <div key={activity._id} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-surface-50">
                      <Avatar user={activity.actor} size="xs" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-surface-700 leading-snug">
                          <span className="font-medium text-surface-900">{activity.actor?.name?.split(' ')[0]}</span>{' '}
                          {activity.summary}
                        </p>
                        <p className="text-2xs text-surface-400 mt-0.5">{relativeTime(activity.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-surface-100 p-1">
                <MenuItem icon={Sparkles} onClick={() => { markSeen(); close(); navigate('/dashboard'); }}>
                  View workspace overview
                </MenuItem>
              </div>
            </div>
          )}
        </Popover>

        <Popover
          width="w-[212px]"
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              className="flex items-center rounded-full hover:opacity-90"
              aria-label="Create new"
              aria-expanded={open}
            >
              <span className="hidden sm:inline-flex btn-primary btn-sm">
                <Plus size={14} /> New
              </span>
              <span className="sm:hidden btn-primary btn-sm px-1.5">
                <Plus size={15} />
              </span>
            </button>
          )}
        >
          {({ close }) => (
            <>
              <MenuItem icon={CheckSquare} onClick={() => { close(); navigate('/tasks/list?new=1'); }}>
                New task
              </MenuItem>
              <MenuItem icon={FolderPlus} onClick={() => { close(); navigate('/projects?new=1'); }}>
                New project
              </MenuItem>
            </>
          )}
        </Popover>

        <Popover
          width="w-[212px]"
          trigger={({ toggle, open }) => (
            <button type="button" onClick={toggle} aria-label="Account menu" aria-expanded={open}>
              <Avatar user={user} size="sm" className="ring-2 ring-white" />
            </button>
          )}
        >
          {({ close }) => (
            <>
              <div className="px-3 py-2 border-b border-surface-100">
                <p className="text-xs font-semibold text-surface-800 truncate">{user?.name}</p>
                <p className="text-2xs text-surface-400 truncate">{user?.email}</p>
              </div>
              <MenuItem onClick={() => { close(); navigate('/profile'); }}>My profile</MenuItem>
              <MenuItem onClick={() => { close(); navigate('/settings'); }}>Settings</MenuItem>
            </>
          )}
        </Popover>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
};

export default TopNav;
