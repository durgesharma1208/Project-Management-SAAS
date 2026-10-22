import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, CheckSquare, Clock, ArrowRight, TrendingUp, Zap } from 'lucide-react';
import { format, isPast, isToday, differenceInDays } from 'date-fns';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { PageLoader } from '../../components/ui/Spinner';
import { PriorityBadge, StatusBadge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';

const StatCard = ({ label, value, icon: Icon, color = 'text-primary-600', bg = 'bg-primary-50' }) => (
  <div className="card p-4 flex items-center gap-4">
    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
      <Icon size={18} className={color} />
    </div>
    <div>
      <p className="text-2xl font-bold text-surface-900">{value}</p>
      <p className="text-xs text-surface-500">{label}</p>
    </div>
  </div>
);

const TaskRow = ({ task }) => {
  const overdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'done';
  const dueToday = task.dueDate && isToday(new Date(task.dueDate));

  return (
    <div className="flex items-center gap-3 py-2.5 px-0 hover:bg-surface-50 -mx-4 px-4 rounded-lg transition-colors group">
      <StatusBadge status={task.status} showLabel={false} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-800 font-medium truncate">{task.title}</p>
        <p className="text-xs text-surface-400 truncate">{task.project?.name}</p>
      </div>
      <PriorityBadge priority={task.priority} showLabel={false} />
      {task.dueDate && (
        <span className={`text-xs ${overdue ? 'text-red-600 font-medium' : dueToday ? 'text-amber-600' : 'text-surface-400'}`}>
          {overdue ? 'Overdue' : isToday(new Date(task.dueDate)) ? 'Today' : format(new Date(task.dueDate), 'MMM d')}
        </span>
      )}
    </div>
  );
};

export const DashboardPage = () => {
  const { user } = useAuth();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', activeWorkspaceId],
    queryFn: () => api.get(`/workspaces/${activeWorkspaceId}/tasks/dashboard`).then(r => r.data.data),
    enabled: !!activeWorkspaceId,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', activeWorkspaceId, 'dashboard'],
    queryFn: () => api.get(`/workspaces/${activeWorkspaceId}/projects?limit=4`).then(r => r.data.data),
    enabled: !!activeWorkspaceId,
  });

  if (!activeWorkspaceId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center">
          <Zap size={28} className="text-primary-600" />
        </div>
        <div className="text-center">
          <h2 className="font-semibold text-surface-900">No workspace selected</h2>
          <p className="text-sm text-surface-500 mt-1">Create or select a workspace to get started</p>
        </div>
      </div>
    );
  }

  if (isLoading) return <PageLoader />;

  const myTasks = data?.myTasks || [];
  const dueSoon = data?.dueSoon || [];
  const statusSummary = data?.statusSummary || [];
  const projects = projectsData?.projects || [];

  const totalTasks = statusSummary.reduce((a, b) => a + b.count, 0);
  const doneTasks = statusSummary.find(s => s._id === 'done')?.count || 0;
  const inProgressTasks = statusSummary.find(s => s._id === 'in_progress')?.count || 0;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-900">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-surface-500 text-sm mt-0.5">Here's what's happening in {activeWorkspace?.name}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => navigate('/projects')}>
            <FolderOpen size={14} /> Projects
          </button>
          <button className="btn-primary" onClick={() => navigate('/projects?new=1')}>
            <Plus size={14} /> New Project
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total tasks" value={totalTasks} icon={CheckSquare} />
        <StatCard label="In progress" value={inProgressTasks} icon={TrendingUp} color="text-amber-600" bg="bg-amber-50" />
        <StatCard label="Completed" value={doneTasks} icon={CheckSquare} color="text-green-600" bg="bg-green-50" />
        <StatCard label="Projects" value={projects.length} icon={FolderOpen} color="text-violet-600" bg="bg-violet-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Tasks */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-surface-900">My Tasks</h2>
            <Link to="/my-tasks" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {myTasks.length === 0 ? (
            <div className="text-center py-8">
              <CheckSquare size={32} className="text-surface-300 mx-auto mb-3" />
              <p className="text-sm text-surface-500">No tasks assigned to you</p>
              <p className="text-xs text-surface-400 mt-1">Tasks assigned to you will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {myTasks.map(task => <TaskRow key={task._id} task={task} />)}
            </div>
          )}
        </div>

        {/* Due Soon */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} className="text-surface-400" />
            <h2 className="font-semibold text-surface-900">Due Soon</h2>
          </div>
          {dueSoon.length === 0 ? (
            <div className="text-center py-6">
              <Clock size={28} className="text-surface-200 mx-auto mb-2" />
              <p className="text-xs text-surface-400">Nothing due in the next 7 days</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dueSoon.map(task => (
                <div key={task._id} className="flex items-start gap-2.5">
                  <StatusBadge status={task.status} showLabel={false} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-surface-800 truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] ${isPast(new Date(task.dueDate)) ? 'text-red-600' : 'text-surface-400'}`}>
                        {isToday(new Date(task.dueDate)) ? 'Today' : format(new Date(task.dueDate), 'MMM d')}
                      </span>
                      {task.assignee && <Avatar user={task.assignee} size="xs" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Projects */}
      {projects.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-surface-900">Recent Projects</h2>
            <Link to="/projects" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {projects.map(p => {
              const total = p.totalTasks || 0;
              const done = p.completedTasks || 0;
              const pct = total ? Math.round((done / total) * 100) : 0;
              return (
                <Link key={p._id} to={`/projects/${p._id}`} className="p-3.5 rounded-xl border border-surface-200 hover:border-primary-200 hover:bg-primary-50/30 transition-all group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{p.emoji || '📋'}</span>
                    <p className="text-sm font-medium text-surface-900 truncate group-hover:text-primary-700">{p.name}</p>
                  </div>
                  <div className="w-full bg-surface-100 rounded-full h-1 mb-1.5">
                    <div className="bg-primary-500 h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-surface-400">{done}/{total} tasks</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty onboarding state */}
      {projects.length === 0 && myTasks.length === 0 && (
        <div className="card p-10 text-center">
          <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Zap size={32} className="text-primary-600" />
          </div>
          <h2 className="text-lg font-semibold text-surface-900 mb-2">Welcome to TaskFlow!</h2>
          <p className="text-surface-500 text-sm mb-6">Get started by creating your first project or inviting team members.</p>
          <div className="flex gap-3 justify-center">
            <button className="btn-primary" onClick={() => navigate('/projects?new=1')}>
              <Plus size={14} /> Create your first project
            </button>
            <button className="btn-secondary" onClick={() => navigate('/settings?tab=members')}>
              Invite team members
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
