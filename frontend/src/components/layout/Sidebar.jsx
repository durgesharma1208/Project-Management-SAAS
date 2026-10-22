import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  LayoutDashboard, CheckSquare, FolderKanban, ListFilter, GitBranch, Users,
  Settings, ChevronsLeft, ChevronsRight, LogOut, Plus, Check, Building2, X, UserRound,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../ui/Toast';
import { Avatar } from '../ui/Avatar';
import { Popover, MenuItem } from '../ui/Menu';
import { Dialog } from '../ui/Dialog';
import { FormField, Input, Textarea } from '../ui/Form';
import { Alert, extractError } from '../ui/Alert';
import { Spinner } from '../ui/Spinner';
import { workspacesApi, workspaceKeys } from '../../lib/taskApi';

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
      { to: '/my-tasks', icon: CheckSquare, label: 'My Tasks' },
    ],
  },
  {
    label: 'Plan & track',
    items: [
      { to: '/projects', icon: FolderKanban, label: 'Projects' },
      { to: '/tasks/list', icon: ListFilter, label: 'All Tasks' },
      { to: '/workflows', icon: GitBranch, label: 'Workflows' },
      { to: '/teams', icon: Users, label: 'Teams' },
    ],
  },
];

const CreateWorkspaceDialog = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const { switchWorkspace } = useWorkspace();
  const toast = useToast();
  const [apiError, setApiError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const mutation = useMutation({
    mutationFn: workspacesApi.create,
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      switchWorkspace(workspace._id);
      toast.success(`Workspace "${workspace.name}" created`);
      reset();
      setApiError(null);
      onClose();
    },
    onError: (error) => setApiError(extractError(error)),
  });

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create workspace"
      description="Workspaces keep projects, teams and members separate."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit((values) => { setApiError(null); mutation.mutate(values); })}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Spinner size={14} />} Create workspace
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert type="error" message={apiError} />
        <FormField label="Workspace name" error={errors.name?.message} required id="ws-name">
          <Input
            id="ws-name"
            {...register('name', { required: 'A workspace name is required', maxLength: { value: 100, message: 'Too long' } })}
            placeholder="Acme Corp"
            error={errors.name}
          />
        </FormField>
        <FormField label="Description" id="ws-desc" hint="Optional, shown to workspace members.">
          <Textarea id="ws-desc" {...register('description')} rows={2} placeholder="What does this workspace cover?" />
        </FormField>
      </div>
    </Dialog>
  );
};

const SidebarContent = ({ collapsed = false, onNavigate, onToggleCollapse }) => {
  const { user, logout } = useAuth();
  const { workspaces, activeWorkspace, activeRole, switchWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Brand */}
      <div className={`flex items-center gap-2.5 h-14 px-3 flex-shrink-0 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-subtle">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2.5 4.5h7M2.5 8h11M2.5 11.5h5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-surface-900 leading-tight">TaskFlow</p>
            <p className="text-2xs text-surface-400 -mt-0.5">Project management</p>
          </div>
        )}
        {!collapsed && onNavigate && (
          <button type="button" className="btn-icon lg:hidden" onClick={onNavigate} aria-label="Close navigation">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Workspace switcher */}
      <div className={`px-2 pb-1 ${collapsed ? 'pt-1' : ''}`}>
        {collapsed ? (
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="w-9 h-9 mx-auto rounded-lg flex items-center justify-center text-white text-xs font-semibold"
            style={{ backgroundColor: activeWorkspace?.color || '#6366f1' }}
            title={activeWorkspace?.name || 'Workspace'}
          >
            {activeWorkspace?.name?.[0]?.toUpperCase() || 'W'}
          </button>
        ) : (
          <Popover
            className="w-full"
            panelClassName="w-[232px]"
            trigger={({ toggle, open }) => (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border border-surface-200 bg-white hover:bg-surface-50 transition-colors text-left"
              >
                <span
                  className="w-5 h-5 rounded flex items-center justify-center text-white text-2xs font-semibold flex-shrink-0"
                  style={{ backgroundColor: activeWorkspace?.color || '#6366f1' }}
                >
                  {activeWorkspace?.name?.[0]?.toUpperCase() || 'W'}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-medium text-surface-800 truncate">
                    {activeWorkspace?.name || 'Select workspace'}
                  </span>
                  <span className="block text-2xs text-surface-400 capitalize">{activeRole}</span>
                </span>
                <ChevronsRight size={13} className="text-surface-400 rotate-90" />
              </button>
            )}
          >
            {({ close }) => (
              <>
                <p className="dropdown-label">Workspaces</p>
                {workspaces.map((ws) => (
                  <MenuItem
                    key={ws._id}
                    icon={ws._id === activeWorkspace?._id ? Check : Building2}
                    onClick={() => { switchWorkspace(ws._id); close(); }}
                  >
                    <span className="truncate">{ws.name}</span>
                  </MenuItem>
                ))}
                <div className="my-1 border-t border-surface-100" />
                <MenuItem icon={Plus} onClick={() => { close(); setCreateOpen(true); }}>
                  Create workspace
                </MenuItem>
              </>
            )}
          </Popover>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2' : 'px-2'} pb-2`}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {collapsed ? (
              <div className="my-2 mx-2 border-t border-surface-100" />
            ) : (
              <p className="nav-section">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onNavigate}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'nav-item-active' : ''} ${collapsed ? 'justify-center px-0 h-9' : ''}`
                  }
                >
                  <Icon size={16} className="flex-shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-surface-200 p-2 flex-shrink-0 space-y-0.5">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) =>
            `nav-item ${isActive ? 'nav-item-active' : ''} ${collapsed ? 'justify-center px-0 h-9' : ''}`
          }
        >
          <Settings size={16} className="flex-shrink-0" />
          {!collapsed && 'Settings'}
        </NavLink>

        {collapsed ? (
          <>
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="nav-item justify-center px-0 h-9 w-full"
              title={`${user?.name} — profile`}
            >
              <Avatar user={user} size="xs" />
            </button>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="nav-item justify-center px-0 h-9 w-full"
              title="Expand sidebar"
            >
              <ChevronsRight size={15} />
            </button>
          </>
        ) : (
          <Popover
            className="w-full"
            panelClassName="w-[228px] bottom-full top-auto mb-1.5"
            trigger={({ toggle, open }) => (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-100 transition-colors text-left"
              >
                <Avatar user={user} size="sm" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-medium text-surface-800 truncate">{user?.name}</span>
                  <span className="block text-2xs text-surface-400 truncate">{user?.email}</span>
                </span>
                <ChevronsLeft size={13} className="text-surface-400 -rotate-90" />
              </button>
            )}
          >
            {({ close }) => (
              <>
                <MenuItem icon={UserRound} onClick={() => { close(); navigate('/profile'); onNavigate?.(); }}>
                  My profile
                </MenuItem>
                <MenuItem icon={Settings} onClick={() => { close(); navigate('/settings'); onNavigate?.(); }}>
                  Workspace settings
                </MenuItem>
                <div className="my-1 border-t border-surface-100" />
                <MenuItem icon={ChevronsLeft} onClick={() => { close(); onToggleCollapse?.(); }}>
                  Collapse sidebar
                </MenuItem>
                <MenuItem
                  icon={LogOut}
                  danger
                  onClick={async () => {
                    close();
                    await handleLogout();
                    toast.info('You have been signed out');
                  }}
                >
                  Sign out
                </MenuItem>
              </>
            )}
          </Popover>
        )}
      </div>

      <CreateWorkspaceDialog isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
};

export const Sidebar = ({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) => (
  <>
    {/* Desktop rail */}
    <aside
      className={`hidden lg:flex flex-col bg-white border-r border-surface-200 h-full flex-shrink-0
        transition-[width] duration-200 ease-smooth ${collapsed ? 'w-[68px]' : 'w-[248px]'}`}
    >
      <SidebarContent collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
    </aside>

    {/* Mobile drawer */}
    <div
      className={`lg:hidden fixed inset-0 z-40 ${mobileOpen ? '' : 'pointer-events-none'}`}
      aria-hidden={!mobileOpen}
    >
      <div
        className={`absolute inset-0 bg-surface-950/40 transition-opacity duration-200 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onCloseMobile}
      />
      <aside
        className={`absolute inset-y-0 left-0 w-[264px] bg-white border-r border-surface-200 flex flex-col
          transition-transform duration-200 ease-smooth ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <SidebarContent onNavigate={onCloseMobile} />
      </aside>
    </div>
  </>
);

export default Sidebar;
