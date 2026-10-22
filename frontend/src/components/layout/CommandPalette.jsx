import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, FolderKanban, ListFilter, CheckSquare, LayoutDashboard, Users,
  GitBranch, Settings, CornerDownLeft, Loader2,
} from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { tasksApi, projectsApi, taskKeys, projectKeys } from '../../lib/taskApi';
import { StatusBadge } from '../ui/Badge';

const PAGES = [
  { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
  { label: 'My Tasks', to: '/my-tasks', icon: CheckSquare },
  { label: 'All Tasks', to: '/tasks/list', icon: ListFilter },
  { label: 'Projects', to: '/projects', icon: FolderKanban },
  { label: 'Workflows', to: '/workflows', icon: GitBranch },
  { label: 'Teams', to: '/teams', icon: Users },
  { label: 'Settings', to: '/settings', icon: Settings },
];

/**
 * Global command palette (⌘K / Ctrl+K).
 * Searches real tasks and projects in the active workspace plus page shortcuts.
 */
export const CommandPalette = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const { activeWorkspaceId } = useWorkspace();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(timer);
  }, [query]);

  // Global shortcut
  useEffect(() => {
    const onKeyDown = (event) => {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isShortcut) {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebounced('');
      setActiveIndex(0);
      return;
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
    };
  }, [open]);

  const searchEnabled = Boolean(activeWorkspaceId) && debounced.length > 1;

  const { data: taskResults, isFetching: tasksLoading } = useQuery({
    queryKey: taskKeys.list(activeWorkspaceId, { scope: 'palette', search: debounced }),
    queryFn: () => tasksApi.list(activeWorkspaceId, { search: debounced, limit: 5 }),
    enabled: open && searchEnabled,
    staleTime: 15_000,
  });

  const { data: projectResults } = useQuery({
    queryKey: projectKeys.list(activeWorkspaceId, { scope: 'palette', search: debounced }),
    queryFn: () => projectsApi.list(activeWorkspaceId, { search: debounced, limit: 4 }),
    enabled: open && searchEnabled,
    staleTime: 15_000,
  });

  const results = useMemo(() => {
    if (!debounced) {
      return PAGES.map((p) => ({ type: 'page', ...p, key: `page-${p.to}` }));
    }
    const tasks = (taskResults?.tasks || []).map((task) => ({
      type: 'task', key: `task-${task._id}`, task,
    }));
    const projects = (projectResults || []).map((project) => ({
      type: 'project', key: `project-${project._id}`, project,
    }));
    const pages = PAGES
      .filter((p) => p.label.toLowerCase().includes(debounced.toLowerCase()))
      .map((p) => ({ type: 'page', ...p, key: `page-${p.to}` }));
    return [...tasks, ...projects, ...pages];
  }, [debounced, taskResults, projectResults]);

  useEffect(() => { setActiveIndex(0); }, [debounced, open]);

  if (!open) return null;

  const select = (item) => {
    onOpenChange(false);
    if (item.type === 'task') navigate(`/tasks/list?task=${item.task._id}`);
    else if (item.type === 'project') navigate(`/projects/${item.project._id}`);
    else navigate(item.to);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      onOpenChange(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    }
    if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      select(results[activeIndex]);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-surface-950/40 z-50 animate-fade-in" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-x-0 top-[12vh] z-[51] flex justify-center px-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search TaskFlow"
          className="w-full max-w-xl bg-white rounded-xl shadow-dialog border border-surface-200 overflow-hidden animate-scale-in"
          onKeyDown={handleKeyDown}
        >
          <div className="flex items-center gap-2.5 px-4 border-b border-surface-200">
            <Search size={16} className="text-surface-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, projects or jump to a page…"
              className="flex-1 py-3 bg-transparent text-sm text-surface-800 placeholder:text-surface-400 focus:outline-none"
              aria-controls="command-results"
              aria-activedescendant={results[activeIndex]?.key}
            />
            {tasksLoading && <Loader2 size={14} className="animate-spin text-surface-400" />}
            <button type="button" className="kbd" onClick={() => onOpenChange(false)}>ESC</button>
          </div>

          <div id="command-results" role="listbox" className="max-h-[52vh] overflow-y-auto py-1.5">
            {results.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-surface-500">
                No results for “{debounced}”. Try a different keyword.
              </p>
            )}

            {results.map((item, index) => (
              <div
                key={item.key}
                role="option"
                aria-selected={index === activeIndex}
                id={item.key}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(item)}
                className={`mx-1.5 px-2.5 py-2 rounded-lg flex items-center gap-2.5 cursor-pointer ${
                  index === activeIndex ? 'bg-primary-50' : 'hover:bg-surface-50'
                }`}
              >
                {item.type === 'task' && (
                  <>
                    <StatusBadge status={item.task.status} showLabel={false} />
                    <span className="flex-1 min-w-0 text-[13px] text-surface-800 truncate">{item.task.title}</span>
                    <span className="text-2xs text-surface-400 truncate max-w-[110px]">
                      {item.task.project?.name}
                    </span>
                  </>
                )}
                {item.type === 'project' && (
                  <>
                    <span className="text-base leading-none">{item.project.emoji || '📋'}</span>
                    <span className="flex-1 min-w-0 text-[13px] text-surface-800 truncate">{item.project.name}</span>
                    <span className="text-2xs text-surface-400">Project</span>
                  </>
                )}
                {item.type === 'page' && (
                  <>
                    <item.icon size={15} className="text-surface-400" />
                    <span className="flex-1 text-[13px] text-surface-800">{item.label}</span>
                    <span className="text-2xs text-surface-400">Page</span>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between px-4 py-2 border-t border-surface-200 bg-surface-50 text-2xs text-surface-400">
            <span className="flex items-center gap-1">
              <CornerDownLeft size={11} /> to open · ↑ ↓ to navigate
            </span>
            <span>Searching {debounced ? `“${debounced}”` : 'quick links'}</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default CommandPalette;
