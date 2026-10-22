import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, ListFilter, GitBranch, FolderOpen, Users, Settings,
  ChevronLeft, ChevronRight, Bell, Plus, LogOut, ChevronDown,
  Building2, User
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { Avatar } from '../ui/Avatar';
import { Dialog } from '../ui/Dialog';
import { FormField, Input } from '../ui/Form';
import { Spinner } from '../ui/Spinner';
import { Alert, extractError } from '../ui/Alert';
import api from '../../lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

const NAV_ITEMS = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Overview' },
  { to: '/my-tasks',     icon: CheckSquare,     label: 'My Tasks' },
  { to: '/tasks/list',   icon: ListFilter,      label: 'All Tasks' },
  { to: '/workflows',    icon: GitBranch,       label: 'Workflows' },
  { to: '/projects',     icon: FolderOpen,      label: 'Projects' },
  { to: '/teams',        icon: Users,           label: 'Teams' },
  { to: '/settings',     icon: Settings,        label: 'Settings' },
];

const CreateWorkspaceDialog = ({ isOpen, onClose }) => {
  const qc = useQueryClient();
  const { switchWorkspace } = useWorkspace();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const [apiError, setApiError] = useState(null);

  const mutation = useMutation({
    mutationFn: (data) => api.post('/workspaces', data).then(r => r.data.data.workspace),
    onSuccess: (ws) => {
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      switchWorkspace(ws._id);
      reset();
      onClose();
    },
    onError: (e) => setApiError(extractError(e)),
  });

  const onSubmit = (data) => { setApiError(null); mutation.mutate(data); };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Create Workspace"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit(onSubmit)} disabled={mutation.isPending}>
            {mutation.isPending && <Spinner size={14} />} Create
          </button>
        </>
      }>
      <div className="space-y-4">
        <Alert type="error" message={apiError} />
        <FormField label="Workspace name" error={errors.name?.message} required>
          <Input {...register('name', { required: 'Name is required' })} placeholder="My Workspace" error={errors.name} />
        </FormField>
        <FormField label="Description" error={errors.description?.message}>
          <Input {...register('description')} placeholder="What is this workspace for?" />
        </FormField>
      </div>
    </Dialog>
  );
};

export const Sidebar = ({ collapsed, onToggle }) => {
  const { user, logout } = useAuth();
  const { workspaces, activeWorkspace, switchWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [wsDropdown, setWsDropdown] = useState(false);
  const [createWsOpen, setCreateWsOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <aside className={`
        fixed top-0 left-0 h-full z-30 flex flex-col bg-white border-r border-surface-200
        transition-all duration-200 ease-in-out
        ${collapsed ? 'w-14' : 'w-56'}
      `}>
        {/* Logo + workspace switcher */}
        <div className="flex items-center gap-2.5 px-3.5 py-4 border-b border-surface-100">
          <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs">T</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-surface-900 truncate">TaskFlow</p>
            </div>
          )}
        </div>

        {/* Workspace switcher */}
        {!collapsed && (
          <div className="relative px-2.5 pt-2.5">
            <button
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-surface-50 transition-colors text-left"
              onClick={() => setWsDropdown(!wsDropdown)}
            >
              <div
                className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: activeWorkspace?.color || '#6366f1' }}
              >
                {activeWorkspace?.name?.[0] || 'W'}
              </div>
              <span className="text-sm font-medium text-surface-800 truncate flex-1">
                {activeWorkspace?.name || 'Select workspace'}
              </span>
              <ChevronDown size={12} className="text-surface-400 flex-shrink-0" />
            </button>

            {wsDropdown && (
              <div className="absolute top-full left-2.5 right-2.5 mt-1 bg-white border border-surface-200 rounded-xl shadow-elevated z-50 overflow-hidden animate-scale-in">
                <div className="p-1">
                  {workspaces.map((ws) => (
                    <button
                      key={ws._id}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-surface-50 transition-colors ${ws._id === activeWorkspace?._id ? 'bg-primary-50 text-primary-700' : 'text-surface-700'}`}
                      onClick={() => { switchWorkspace(ws._id); setWsDropdown(false); }}
                    >
                      <div className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: ws.color || '#6366f1' }}>
                        {ws.name?.[0]}
                      </div>
                      <span className="truncate">{ws.name}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-surface-100 p-1">
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-surface-600 hover:bg-surface-50"
                    onClick={() => { setWsDropdown(false); setCreateWsOpen(true); }}
                  >
                    <Plus size={14} /> New Workspace
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-2 space-y-0.5">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''} ${collapsed ? 'justify-center px-0' : ''}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User profile + collapse toggle */}
        <div className="border-t border-surface-100 p-2.5 space-y-1">
          <button
            className={`nav-item w-full ${collapsed ? 'justify-center' : ''}`}
            onClick={() => navigate('/profile')}
          >
            <Avatar user={user} size="xs" />
            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-surface-800 truncate">{user?.name}</p>
                <p className="text-[10px] text-surface-500 truncate">{user?.email}</p>
              </div>
            )}
          </button>

          <button className={`nav-item w-full text-red-500 hover:text-red-600 hover:bg-red-50 ${collapsed ? 'justify-center' : ''}`} onClick={handleLogout}>
            <LogOut size={14} />
            {!collapsed && <span>Logout</span>}
          </button>

          <button
            className="nav-item w-full justify-end"
            onClick={onToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} />{!collapsed && <span className="text-xs">Collapse</span>}</>}
          </button>
        </div>
      </aside>

      <CreateWorkspaceDialog isOpen={createWsOpen} onClose={() => setCreateWsOpen(false)} />
    </>
  );
};
