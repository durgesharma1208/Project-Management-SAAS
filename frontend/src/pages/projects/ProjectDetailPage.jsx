import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity as ActivityIcon, Archive, ArchiveRestore, ArrowLeft, BarChart3, CalendarDays,
  CheckSquare, Flame, GitBranch, Kanban, ListChecks, MoreHorizontal, Network, Pencil,
  Plus, Trash2, Users,
} from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../components/ui/Toast';
import { PageHeader, PageSkeleton, EmptyState, ProgressBar, StatCard } from '../../components/ui/Primitives';
import { ErrorState } from '../../components/ui/Primitives';
import { PriorityBadge, ProjectStatusBadge, StatusBadge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Tabs } from '../../components/ui/Tabs';
import { Popover, MenuItem } from '../../components/ui/Menu';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ProjectFormDialog } from '../../components/projects/ProjectFormDialog';
import { TaskFormDialog } from '../../components/tasks/TaskFormDialog';
import { TaskPanel } from '../../components/tasks/TaskPanel';
import { TaskListItem } from '../../components/tasks/TaskListItem';
import { projectsApi, tasksApi, projectKeys, taskKeys, dashboardKeys } from '../../lib/taskApi';
import { TASK_STATUSES } from '../../lib/constants';
import { formatDate, relativeTime } from '../../lib/format';
import { extractError } from '../../components/ui/Alert';

const VIEW_LINKS = [
  { key: 'board', label: 'Board', icon: Kanban, path: 'board' },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays, path: 'calendar' },
  { key: 'gantt', label: 'Timeline', icon: BarChart3, path: 'gantt' },
  { key: 'dependencies', label: 'Dependencies', icon: Network, path: 'dependencies' },
  { key: 'critical', label: 'Critical path', icon: Flame, path: 'critical-path' },
];

export const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const { activeWorkspaceId } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [confirm, setConfirm] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: projectKeys.detail(activeWorkspaceId, projectId),
    queryFn: () => projectsApi.get(activeWorkspaceId, projectId),
    enabled: Boolean(activeWorkspaceId && projectId),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: taskKeys.list(activeWorkspaceId, { project: projectId, status: statusFilter }),
    queryFn: () => tasksApi.list(activeWorkspaceId, {
      project: projectId,
      status: statusFilter || undefined,
      limit: 200,
      sort: 'updatedAt',
      dir: 'desc',
    }).then((result) => result.tasks),
    enabled: Boolean(activeWorkspaceId && projectId) && (tab === 'tasks' || tab === 'overview'),
  });

  const { data: activity = [] } = useQuery({
    queryKey: projectKeys.activity(activeWorkspaceId, projectId),
    queryFn: () => projectsApi.activity(activeWorkspaceId, projectId, { limit: 30 }),
    enabled: Boolean(activeWorkspaceId && projectId) && tab === 'activity',
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: projectKeys.all(activeWorkspaceId) });
    queryClient.invalidateQueries({ queryKey: projectKeys.detail(activeWorkspaceId, projectId) });
    queryClient.invalidateQueries({ queryKey: taskKeys.all(activeWorkspaceId) });
    queryClient.invalidateQueries({ queryKey: dashboardKeys.workspace(activeWorkspaceId) });
  };

  const archiveMutation = useMutation({
    mutationFn: () => projectsApi.archive(activeWorkspaceId, projectId),
    onSuccess: () => { invalidate(); toast.success('Project archived'); setConfirm(null); },
    onError: (error) => toast.error(extractError(error)),
  });

  const restoreMutation = useMutation({
    mutationFn: () => projectsApi.restore(activeWorkspaceId, projectId),
    onSuccess: () => { invalidate(); toast.success('Project restored'); setConfirm(null); },
    onError: (error) => toast.error(extractError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.remove(activeWorkspaceId, projectId),
    onSuccess: () => {
      invalidate();
      toast.success('Project deleted');
      navigate('/projects');
    },
    onError: (error) => toast.error(extractError(error)),
  });

  const completeMutation = useMutation({
    mutationFn: (task) => tasksApi.update(activeWorkspaceId, task._id, {
      status: task.status === 'done' ? 'todo' : 'done',
    }),
    onSuccess: () => { invalidate(); toast.success('Task updated'); },
    onError: (error) => toast.error(extractError(error)),
  });

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message="This project could not be loaded." onRetry={refetch} />;

  const { project, taskCounts = {}, overdueTasks = 0, workload = [] } = data || {};
  if (!project) {
    return (
      <div className="page">
        <EmptyState
          icon={Archive}
          title="Project not found"
          description="It may have been deleted, or you may not have access to it."
          action={<Link to="/projects" className="btn-secondary">Back to projects</Link>}
        />
      </div>
    );
  }

  const totalTasks = project.totalTasks || Object.values(taskCounts).reduce((a, b) => a + b, 0);
  const doneTasks = taskCounts.done || 0;
  const progress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const openTasks = tasks.filter((t) => t.status !== 'done');

  const taskTab = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="input w-auto"
          aria-label="Filter tasks by status"
        >
          <option value="">All statuses</option>
          {TASK_STATUSES.map((status) => (
            <option key={status.id} value={status.id}>{status.label}</option>
          ))}
        </select>
        <span className="text-xs text-surface-500">{tasks.length} tasks</span>
        <div className="flex-1" />
        <button type="button" className="btn-primary btn-sm" onClick={() => setTaskFormOpen(true)}>
          <Plus size={13} /> Add task
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ListChecks}
            title={statusFilter ? 'No tasks with this status' : 'No tasks yet'}
            description={statusFilter ? 'Try a different status filter.' : 'Break the project down into tasks so the team knows what to do next.'}
            action={<button type="button" className="btn-primary" onClick={() => setTaskFormOpen(true)}><Plus size={14} /> Add the first task</button>}
          />
        </div>
      ) : (
        <div className="card divide-y divide-surface-100 overflow-hidden">
          {tasks.map((task) => (
            <TaskListItem
              key={task._id}
              task={task}
              onOpen={setSelectedTaskId}
              onToggleComplete={(t) => completeMutation.mutate(t)}
              isToggling={completeMutation.isPending && completeMutation.variables?._id === task._id}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="page">
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-800 mb-3">
        <ArrowLeft size={13} /> Projects
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: `${project.color}1a` }}>
              {project.emoji || '📋'}
            </span>
            <span className="truncate">{project.name}</span>
          </span>
        }
        description={project.description || 'No description yet.'}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditOpen(true)}>
              <Pencil size={14} /> Edit
            </button>
            <button type="button" className="btn-primary" onClick={() => setTaskFormOpen(true)}>
              <Plus size={14} /> Add task
            </button>
            <Popover
              width="w-[200px]"
              trigger={({ toggle }) => (
                <button type="button" className="btn-icon border border-surface-200" onClick={toggle} aria-label="Project actions">
                  <MoreHorizontal size={16} />
                </button>
              )}
            >
              {({ close }) => (
                <>
                  {project.isArchived ? (
                    <MenuItem icon={ArchiveRestore} onClick={() => { close(); setConfirm('restore'); }}>Restore project</MenuItem>
                  ) : (
                    <MenuItem icon={Archive} onClick={() => { close(); setConfirm('archive'); }}>Archive project</MenuItem>
                  )}
                  <div className="my-1 border-t border-surface-100" />
                  <MenuItem icon={Trash2} danger onClick={() => { close(); setConfirm('delete'); }}>Delete project</MenuItem>
                </>
              )}
            </Popover>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <ProjectStatusBadge status={project.status} />
          <PriorityBadge priority={project.priority} />
          <span className="flex items-center gap-1 text-2xs text-surface-400">
            <Users size={11} /> {(project.members || []).length} members
          </span>
          {project.dueDate && (
            <span className="flex items-center gap-1 text-2xs text-surface-400">
              <CalendarDays size={11} /> Due {formatDate(project.dueDate, 'MMM d, yyyy')}
            </span>
          )}
        </div>
      </PageHeader>

      {/* View switcher */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {VIEW_LINKS.map((view) => (
          <button
            key={view.key}
            type="button"
            onClick={() => navigate(`/projects/${projectId}/${view.path}`)}
            className="btn-secondary btn-sm"
          >
            <view.icon size={13} /> {view.label}
          </button>
        ))}
      </div>

      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: totalTasks },
          { id: 'activity', label: 'Activity', icon: ActivityIcon },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Tasks" value={totalTasks} icon={ListChecks} tone="primary" />
              <StatCard label="Completed" value={doneTasks} icon={CheckSquare} tone="success" hint={`${progress}% of all tasks`} />
              <StatCard label="Open" value={totalTasks - doneTasks} tone="default" />
              <StatCard label="Overdue" value={overdueTasks} tone={overdueTasks ? 'danger' : 'default'} />
            </div>

            <section className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title">Progress</h2>
                <span className="text-xs font-medium text-surface-700">{progress}%</span>
              </div>
              <ProgressBar value={progress} color={project.color || '#6366f1'} label="Project progress" />
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
                {TASK_STATUSES.map((status) => (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => { setStatusFilter(status.id); setTab('tasks'); }}
                    className="rounded-lg border border-surface-200 p-2.5 text-left hover:border-surface-300 hover:bg-surface-50 transition-colors"
                  >
                    <p className="text-lg font-semibold text-surface-900 tabular-nums leading-tight">{taskCounts[status.id] || 0}</p>
                    <StatusBadge status={status.id} />
                  </button>
                ))}
              </div>
            </section>

            <section className="card">
              <header className="flex items-center justify-between px-4 h-12 border-b border-surface-100">
                <h2 className="section-title">Tasks in progress</h2>
                <button type="button" className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1" onClick={() => setTab('tasks')}>
                  View all tasks <ArrowLeft size={12} className="rotate-180" />
                </button>
              </header>
              {openTasks.length === 0 ? (
                <EmptyState
                  compact
                  icon={CheckSquare}
                  title="Everything is wrapped up"
                  description="There are no open tasks in this project right now."
                />
              ) : (
                <div className="divide-y divide-surface-100">
                  {openTasks.slice(0, 6).map((task) => (
                    <TaskListItem
                      key={task._id}
                      task={task}
                      onOpen={setSelectedTaskId}
                      onToggleComplete={(t) => completeMutation.mutate(t)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="card p-4">
              <h2 className="section-title flex items-center gap-1.5 mb-3">
                <GitBranch size={13} className="text-surface-400" /> Workload
              </h2>
              {workload.length === 0 ? (
                <p className="text-xs text-surface-400">No tasks are assigned to a member yet.</p>
              ) : (
                <div className="space-y-2">
                  {workload.map((row) => (
                    <div key={row._id} className="flex items-center gap-2.5">
                      <Avatar user={row} size="xs" />
                      <span className="text-xs text-surface-700 w-28 truncate">{row.name}</span>
                      <ProgressBar value={(row.count / Math.max(...workload.map((w) => w.count))) * 100} color={project.color || '#6366f1'} className="flex-1" />
                      <span className="text-2xs text-surface-500 tabular-nums w-6 text-right">{row.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-4">
            <section className="card p-4">
              <h2 className="section-title mb-3">Details</h2>
              <dl className="space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-surface-500 flex items-center gap-1.5"><Users size={13} /> Owner</dt>
                  <dd className="flex items-center gap-1.5 min-w-0">
                    <Avatar user={project.owner} size="xs" />
                    <span className="text-surface-800 truncate">{project.owner?.name || '—'}</span>
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-surface-500">Created</dt>
                  <dd className="text-surface-800">{formatDate(project.createdAt, 'MMM d, yyyy')}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-surface-500">Start date</dt>
                  <dd className="text-surface-800">{project.startDate ? formatDate(project.startDate, 'MMM d, yyyy') : '—'}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-surface-500">Due date</dt>
                  <dd className="text-surface-800">{project.dueDate ? formatDate(project.dueDate, 'MMM d, yyyy') : '—'}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-surface-500">Priority</dt>
                  <dd><PriorityBadge priority={project.priority} /></dd>
                </div>
              </dl>
            </section>

            <section className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title">Members</h2>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setEditOpen(true)}>Manage</button>
              </div>
              {(project.members || []).length === 0 ? (
                <p className="text-xs text-surface-400">No members added yet.</p>
              ) : (
                <div className="space-y-2">
                  {project.members.map((member) => (
                    <div key={member._id} className="flex items-center gap-2.5">
                      <Avatar user={member} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-surface-800 truncate">{member.name}</p>
                        <p className="text-2xs text-surface-400 truncate">{member.email}</p>
                      </div>
                      {member._id === project.owner?._id && <span className="badge bg-surface-100 text-surface-500 ml-auto">Owner</span>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card p-4">
              <h2 className="section-title mb-2">Views</h2>
              <div className="grid grid-cols-2 gap-1.5">
                {VIEW_LINKS.map((view) => (
                  <button
                    key={view.key}
                    type="button"
                    onClick={() => navigate(`/projects/${projectId}/${view.path}`)}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-surface-600 hover:bg-surface-50 hover:text-surface-900"
                  >
                    <view.icon size={13} /> {view.label}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {tab === 'tasks' && taskTab}

      {tab === 'activity' && (
        <div className="card">
          {activity.length === 0 ? (
            <EmptyState icon={ActivityIcon} title="No activity yet" description="Updates, status changes and comments will appear here." />
          ) : (
            <div className="divide-y divide-surface-100">
              {activity.map((item) => (
                <div key={item._id} className="flex items-start gap-2.5 px-4 py-3">
                  <Avatar user={item.actor} size="xs" />
                  <p className="text-[13px] text-surface-600 flex-1">
                    <span className="font-medium text-surface-900">{item.actor?.name}</span> {item.summary}
                    <span className="block text-2xs text-surface-400 mt-0.5">{relativeTime(item.createdAt)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ProjectFormDialog isOpen={editOpen} project={project} onClose={() => setEditOpen(false)} />
      <TaskFormDialog
        isOpen={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
        defaults={{ projectId }}
      />
      {selectedTaskId && <TaskPanel taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}

      <ConfirmDialog
        isOpen={confirm === 'archive'}
        onClose={() => setConfirm(null)}
        onConfirm={() => archiveMutation.mutate()}
        title="Archive project"
        message="This project will be hidden from the active list. You can restore it from the archive at any time."
        confirmLabel="Archive project"
        isPending={archiveMutation.isPending}
      />
      <ConfirmDialog
        isOpen={confirm === 'restore'}
        onClose={() => setConfirm(null)}
        onConfirm={() => restoreMutation.mutate()}
        title="Restore project"
        message="This project will return to your active projects."
        confirmLabel="Restore project"
        isPending={restoreMutation.isPending}
      />
      <ConfirmDialog
        isOpen={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete project"
        message="All tasks, comments and dependencies in this project will be deleted permanently. This cannot be undone."
        confirmLabel="Delete permanently"
        danger
        isPending={deleteMutation.isPending}
      />
    </div>
  );
};

export default ProjectDetailPage;
