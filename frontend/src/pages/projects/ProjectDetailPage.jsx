import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Edit2, Archive, Trash2, Users, Calendar, Flag, BarChart2,
  Plus, ExternalLink, Activity, Kanban, List, Network, Flame
} from 'lucide-react';
import { format } from 'date-fns';
import api from '../../lib/api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { PageLoader } from '../../components/ui/Spinner';
import { ProjectStatusBadge, PriorityBadge, StatusBadge } from '../../components/ui/Badge';
import { Avatar, AvatarGroup } from '../../components/ui/Avatar';
import { Alert, extractError } from '../../components/ui/Alert';

const ActivityItem = ({ activity }) => (
  <div className="flex items-start gap-3 py-3">
    <Avatar user={activity.actor} size="xs" />
    <div>
      <p className="text-sm text-surface-700">
        <span className="font-medium">{activity.actor?.name}</span>{' '}
        <span className="text-surface-500">{activity.summary}</span>
      </p>
      <p className="text-xs text-surface-400 mt-0.5">{format(new Date(activity.createdAt), 'MMM d, h:mm a')}</p>
    </div>
  </div>
);

export const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const { activeWorkspaceId } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [apiError, setApiError] = useState(null);

  const { data: projectData, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get(`/workspaces/${activeWorkspaceId}/projects/${projectId}`).then(r => r.data.data),
    enabled: !!activeWorkspaceId && !!projectId,
  });

  const { data: activityData } = useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: () => api.get(`/workspaces/${activeWorkspaceId}/projects/${projectId}/activity`).then(r => r.data.data),
    enabled: !!activeWorkspaceId && !!projectId && activeTab === 'activity',
  });

  const archiveMutation = useMutation({
    mutationFn: () => api.post(`/workspaces/${activeWorkspaceId}/projects/${projectId}/archive`),
    onSuccess: () => navigate('/projects'),
    onError: (e) => setApiError(extractError(e)),
  });

  if (isLoading) return <PageLoader />;
  const { project, taskCounts } = projectData || {};
  if (!project) return <div className="p-6 text-surface-500">Project not found</div>;

  const totalTasks = Object.values(taskCounts || {}).reduce((a, b) => a + b, 0);
  const doneTasks = taskCounts?.done || 0;
  const pct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'board', label: 'Board', icon: Kanban },
    { id: 'activity', label: 'Activity', icon: Activity },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back + header */}
      <div className="flex items-start gap-4 mb-6">
        <button onClick={() => navigate('/projects')} className="btn-ghost p-2 mt-0.5">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-3xl">{project.emoji || '📋'}</span>
            <h1 className="text-2xl font-bold text-surface-900">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
            <PriorityBadge priority={project.priority} />
          </div>
          {project.description && (
            <p className="text-surface-500 mt-2 text-sm">{project.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary btn-sm"
            onClick={() => navigate(`/projects/${projectId}/board`)}
          >
            <Kanban size={13} /> Open Board
          </button>
          <button
            className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
            onClick={() => archiveMutation.mutate()}
          >
            <Archive size={13} /> Archive
          </button>
        </div>
      </div>

      <Alert type="error" message={apiError} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-200 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-surface-500 hover:text-surface-900'
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {/* Task status breakdown */}
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4">Task Progress</h3>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 bg-surface-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-primary-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-surface-700 w-10 text-right">{pct}%</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {['backlog', 'todo', 'in_progress', 'in_review', 'done'].map(s => (
                  <div key={s} className="text-center">
                    <p className="text-xl font-bold text-surface-900">{taskCounts?.[s] || 0}</p>
                    <StatusBadge status={s} />
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4">Views & Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <button
                  className="btn-secondary justify-start gap-2"
                  onClick={() => navigate(`/projects/${projectId}/board`)}
                >
                  <Kanban size={14} /> Kanban Board
                </button>
                <button
                  className="btn-secondary justify-start gap-2"
                  onClick={() => navigate(`/projects/${projectId}/calendar`)}
                >
                  <Calendar size={14} /> Calendar View
                </button>
                <button
                  className="btn-secondary justify-start gap-2"
                  onClick={() => navigate(`/projects/${projectId}/gantt`)}
                >
                  <BarChart2 size={14} className="rotate-90" /> Gantt View
                </button>
                <button
                  className="btn-secondary justify-start gap-2"
                  onClick={() => navigate(`/projects/${projectId}/dependencies`)}
                >
                  <Network size={14} /> Dependencies
                </button>
                <button
                  className="btn-secondary justify-start gap-2 text-red-600"
                  onClick={() => navigate(`/projects/${projectId}/critical-path`)}
                >
                  <Flame size={14} /> Critical Path
                </button>
                <button
                  className="btn-primary justify-start gap-2"
                  onClick={() => navigate(`/projects/${projectId}/board?new=1`)}
                >
                  <Plus size={14} /> Add Task
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar info */}
          <div className="space-y-4">
            <div className="card p-4 space-y-4">
              <h3 className="font-semibold text-surface-800 text-sm">Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-surface-500 flex items-center gap-1.5"><Users size={13} /> Owner</span>
                  <div className="flex items-center gap-1.5">
                    <Avatar user={project.owner} size="xs" />
                    <span className="text-surface-800">{project.owner?.name}</span>
                  </div>
                </div>
                {project.startDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-surface-500 flex items-center gap-1.5"><Calendar size={13} /> Start</span>
                    <span className="text-surface-800">{format(new Date(project.startDate), 'MMM d, yyyy')}</span>
                  </div>
                )}
                {project.dueDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-surface-500 flex items-center gap-1.5"><Calendar size={13} /> Due</span>
                    <span className="text-surface-800">{format(new Date(project.dueDate), 'MMM d, yyyy')}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-surface-500">Tasks</span>
                  <span className="text-surface-800 font-medium">{totalTasks}</span>
                </div>
              </div>
            </div>

            {/* Members */}
            <div className="card p-4">
              <h3 className="font-semibold text-surface-800 text-sm mb-3">Members</h3>
              <div className="space-y-2">
                {(project.members || []).map(m => (
                  <div key={m._id} className="flex items-center gap-2.5">
                    <Avatar user={m} size="xs" />
                    <div>
                      <p className="text-xs font-medium text-surface-800">{m.name}</p>
                      <p className="text-[10px] text-surface-400">{m.email}</p>
                    </div>
                  </div>
                ))}
                {(project.members || []).length === 0 && (
                  <p className="text-xs text-surface-400">No members added</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity tab */}
      {activeTab === 'activity' && (
        <div className="card p-5">
          {(activityData?.activities || []).length === 0 ? (
            <div className="text-center py-10">
              <Activity size={32} className="text-surface-200 mx-auto mb-3" />
              <p className="text-sm text-surface-400">No activity yet</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {activityData.activities.map(a => <ActivityItem key={a._id} activity={a} />)}
            </div>
          )}
        </div>
      )}

      {/* Board redirect tab */}
      {activeTab === 'board' && (
        <div className="text-center py-10">
          <Kanban size={48} className="text-surface-200 mx-auto mb-4" />
          <p className="text-surface-500 mb-4">The Kanban board opens in its own view</p>
          <button className="btn-primary" onClick={() => navigate(`/projects/${projectId}/board`)}>
            Open Kanban Board
          </button>
        </div>
      )}
    </div>
  );
};
