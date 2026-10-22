import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, CalendarClock, CheckSquare, CircleDot, Clock, FolderKanban,
  Plus, TrendingUp, AlertTriangle, Sparkles, Activity as ActivityIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../components/ui/Toast';
import { Avatar } from '../../components/ui/Avatar';
import { PriorityBadge, StatusBadge } from '../../components/ui/Badge';
import { TaskListItem } from '../../components/tasks/TaskListItem';
import { TaskFormDialog } from '../../components/tasks/TaskFormDialog';
import { TaskPanel } from '../../components/tasks/TaskPanel';
import { EmptyState, PageHeader, PageSkeleton, ProgressBar, StatCard } from '../../components/ui/Primitives';
import { ErrorState } from '../../components/ui/Primitives';
import { tasksApi, dashboardKeys, taskKeys, projectKeys } from '../../lib/taskApi';
import { resolveStatusMeta, TASK_STATUSES, TASK_PRIORITIES } from '../../lib/constants';
import { dueLabel, formatDate, relativeTime } from '../../lib/format';
import { extractError } from '../../components/ui/Alert';

const greetingForHour = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export const DashboardPage = () => {
  const { user } = useAuth();
  const { activeWorkspace, activeWorkspaceId } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: dashboardKeys.workspace(activeWorkspaceId),
    queryFn: () => tasksApi.dashboard(activeWorkspaceId),
    enabled: Boolean(activeWorkspaceId),
  });

  const completeMutation = useMutation({
    mutationFn: (task) => tasksApi.update(activeWorkspaceId, task._id, {
      status: task.status === 'done' ? 'todo' : 'done',
    }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.workspace(activeWorkspaceId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.all(activeWorkspaceId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.all(activeWorkspaceId) });
      toast.success(task.status === 'done' ? 'Task completed' : 'Task reopened');
    },
    onError: (error) => toast.error(extractError(error)),
  });

  const counts = data?.counts || {};
  const statusSummary = data?.statusSummary || [];
  const prioritySummary = data?.prioritySummary || [];
  const myTasks = data?.myTasks || [];
  const dueSoon = data?.dueSoon || [];
  const overdueTasks = data?.overdueTasks || [];
  const recentActivity = data?.recentActivity || [];
  const projects = data?.projects || [];
  const isEmptyWorkspace = !isLoading && (counts.totalTasks || 0) === 0 && projects.length === 0;

  const completionDelta = useMemo(() => {
    const current = counts.completedThisWeek || 0;
    const previous = counts.completedPrevWeek || 0;
    return current - previous;
  }, [counts.completedThisWeek, counts.completedPrevWeek]);

  const statusTotal = statusSummary.reduce((sum, item) => sum + item.count, 0) || 1;

  if (!activeWorkspaceId) {
    return (
      <div className="page">
        <EmptyState
          icon={Sparkles}
          title="Create your first workspace"
          description="Workspaces organise your projects, teams and members. Create one from the sidebar to get started."
        />
      </div>
    );
  }

  if (isLoading) return <PageSkeleton />;
  if (isError) {
    return <ErrorState message="We couldn't load your workspace overview." onRetry={refetch} />;
  }

  return (
    <div className="page">
      <PageHeader
        title={`${greetingForHour()}, ${user?.name?.split(' ')[0] || 'there'}`}
        description={`Here's what's happening in ${activeWorkspace?.name || 'your workspace'}.`}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => navigate('/projects?new=1')}>
              <FolderKanban size={14} /> New project
            </button>
            <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> New task
            </button>
          </>
        }
      />

      {isEmptyWorkspace ? (
        <div className="card p-8 sm:p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={26} className="text-primary-600" />
          </div>
          <h2 className="text-lg font-semibold text-surface-900">Welcome to TaskFlow</h2>
          <p className="text-[13px] text-surface-500 mt-1 max-w-md mx-auto">
            Projects hold your tasks, boards, calendar and timelines. Create your first project, then add tasks to plan the work.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-5">
            <button type="button" className="btn-primary" onClick={() => navigate('/projects?new=1')}>
              <Plus size={14} /> Create a project
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/settings?tab=members')}>
              Invite your team
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 text-left max-w-2xl mx-auto">
            {[
              { title: '1. Create a project', body: 'Group related work with a status and due date.' },
              { title: '2. Add tasks', body: 'Assign owners, priorities and deadlines.' },
              { title: '3. Track progress', body: 'Use the board, calendar and timeline views.' },
            ].map((step) => (
              <div key={step.title} className="rounded-lg border border-surface-200 p-3.5">
                <p className="text-xs font-semibold text-surface-800">{step.title}</p>
                <p className="text-xs text-surface-500 mt-1">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Open tasks"
              value={counts.openTasks ?? 0}
              icon={CheckSquare}
              tone="primary"
              hint={`${counts.inProgressTasks ?? 0} in progress`}
            />
            <StatCard
              label="Due today"
              value={counts.dueTodayTasks ?? 0}
              icon={CalendarClock}
              tone={counts.dueTodayTasks ? 'warning' : 'default'}
              hint={`${counts.overdueTasks ?? 0} overdue`}
            />
            <StatCard
              label="Completed this week"
              value={counts.completedThisWeek ?? 0}
              icon={TrendingUp}
              tone="success"
              hint={completionDelta === 0 ? 'Same as last week' : `${completionDelta > 0 ? '+' : ''}${completionDelta} vs last week`}
            />
            <StatCard
              label="Active projects"
              value={counts.activeProjectCount ?? 0}
              icon={FolderKanban}
              hint={`${counts.projectCount ?? 0} total projects`}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Focus list */}
            <section className="card xl:col-span-2 flex flex-col">
              <header className="flex items-center justify-between px-4 h-12 border-b border-surface-100">
                <div className="flex items-center gap-2">
                  <h2 className="section-title">Your focus</h2>
                  <span className="badge bg-primary-50 text-primary-700">{counts.myOpenTasks ?? myTasks.length}</span>
                </div>
                <Link to="/my-tasks" className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1">
                  All my tasks <ArrowRight size={12} />
                </Link>
              </header>
              {myTasks.length === 0 ? (
                <EmptyState
                  compact
                  icon={CheckSquare}
                  title="Nothing assigned to you"
                  description="Tasks assigned to you will show up here so you always know what to work on next."
                  action={<button type="button" className="btn-secondary btn-sm" onClick={() => setCreateOpen(true)}>Create a task</button>}
                />
              ) : (
                <div className="divide-y divide-surface-100">
                  {myTasks.map((task) => (
                    <TaskListItem
                      key={task._id}
                      task={task}
                      showProject
                      onOpen={setSelectedTaskId}
                      onToggleComplete={(t) => completeMutation.mutate(t)}
                      isToggling={completeMutation.isPending && completeMutation.variables?._id === task._id}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Deadlines */}
            <section className="card flex flex-col">
              <header className="flex items-center justify-between px-4 h-12 border-b border-surface-100">
                <h2 className="section-title flex items-center gap-1.5">
                  <Clock size={14} className="text-surface-400" /> Upcoming deadlines
                </h2>
                <span className="text-2xs text-surface-400">Next 7 days</span>
              </header>

              <div className="divide-y divide-surface-100">
                {overdueTasks.map((task) => (
                  <button
                    key={task._id}
                    type="button"
                    onClick={() => setSelectedTaskId(task._id)}
                    className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-red-50/40"
                  >
                    <AlertTriangle size={13} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-surface-800 truncate">{task.title}</p>
                      <p className="text-2xs text-red-600 mt-0.5">{dueLabel(task.dueDate)} · {task.project?.name}</p>
                    </div>
                    {task.assignee && <Avatar user={task.assignee} size="xs" />}
                  </button>
                ))}

                {dueSoon.length === 0 && overdueTasks.length === 0 ? (
                  <EmptyState
                    compact
                    icon={CalendarClock}
                    title="No deadlines this week"
                    description="Tasks with due dates in the next seven days appear here."
                  />
                ) : (
                  dueSoon.map((task) => (
                    <button
                      key={task._id}
                      type="button"
                      onClick={() => setSelectedTaskId(task._id)}
                      className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-surface-50"
                    >
                      <StatusBadge status={task.status} showLabel={false} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-surface-800 truncate">{task.title}</p>
                        <p className="text-2xs text-surface-400 mt-0.5">
                          {formatDate(task.dueDate, 'EEE, MMM d')} · {task.project?.name}
                        </p>
                      </div>
                      {task.assignee && <Avatar user={task.assignee} size="xs" />}
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Projects */}
            <section className="card xl:col-span-2">
              <header className="flex items-center justify-between px-4 h-12 border-b border-surface-100">
                <h2 className="section-title">Recent projects</h2>
                <Link to="/projects" className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1">
                  View all <ArrowRight size={12} />
                </Link>
              </header>
              {projects.length === 0 ? (
                <EmptyState
                  compact
                  icon={FolderKanban}
                  title="No projects yet"
                  description="Create a project to start planning work."
                  action={<button type="button" className="btn-primary btn-sm" onClick={() => navigate('/projects?new=1')}>New project</button>}
                />
              ) : (
                <div className="divide-y divide-surface-100">
                  {projects.map((project) => (
                    <Link
                      key={project._id}
                      to={`/projects/${project._id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors"
                    >
                      <span className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center text-base flex-shrink-0">
                        {project.emoji || '📋'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-medium text-surface-800 truncate">{project.name}</p>
                          {project.priority && project.priority !== 'medium' && (
                            <PriorityBadge priority={project.priority} showLabel={false} />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <ProgressBar
                            value={project.progress ?? 0}
                            color={project.color || '#6366f1'}
                            className="max-w-[180px]"
                            label={`${project.name} progress`}
                          />
                          <span className="text-2xs text-surface-400 whitespace-nowrap">
                            {project.completedTasks}/{project.totalTasks} tasks
                          </span>
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center -space-x-1.5">
                        {(project.members || []).slice(0, 3).map((member) => (
                          <Avatar key={member._id} user={member} size="xs" className="ring-2 ring-white" />
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Status / activity */}
            <div className="space-y-4">
              <section className="card">
                <header className="px-4 h-12 flex items-center justify-between border-b border-surface-100">
                  <h2 className="section-title flex items-center gap-1.5">
                    <CircleDot size={14} className="text-surface-400" /> Tasks by status
                  </h2>
                  <span className="text-2xs text-surface-400">{counts.totalTasks ?? 0} total</span>
                </header>
                <div className="p-4 space-y-3">
                  <div className="flex h-2 rounded-full overflow-hidden bg-surface-100">
                    {TASK_STATUSES.map((status) => {
                      const count = statusSummary.find((s) => s._id === status.id)?.count || 0;
                      if (!count) return null;
                      return (
                        <div
                          key={status.id}
                          style={{ width: `${(count / statusTotal) * 100}%`, backgroundColor: status.color }}
                          title={`${status.label}: ${count}`}
                        />
                      );
                    })}
                  </div>
                  <div className="space-y-1.5">
                    {TASK_STATUSES.map((status) => {
                      const count = statusSummary.find((s) => s._id === status.id)?.count || 0;
                      return (
                        <div key={status.id} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-surface-600">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
                            {resolveStatusMeta(status.id).label}
                          </span>
                          <span className="text-surface-500 tabular-nums">{count}</span>
                        </div>
                      );
                    })}
                  </div>

                  {prioritySummary.length > 0 && (
                    <div className="pt-2 border-t border-surface-100">
                      <p className="text-2xs font-semibold uppercase tracking-wider text-surface-400 mb-2">Open by priority</p>
                      <div className="flex flex-wrap gap-1.5">
                        {TASK_PRIORITIES.filter((p) => p.id !== 'none').map((priority) => {
                          const count = prioritySummary.find((s) => s._id === priority.id)?.count || 0;
                          if (!count) return null;
                          return (
                            <span key={priority.id} className={`badge ${priority.chip}`}>
                              {priority.label} · {count}
                            </span>
                          );
                        })}
                        {counts.unassignedTasks > 0 && (
                          <span className="badge bg-surface-100 text-surface-600">
                            Unassigned · {counts.unassignedTasks}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="card">
                <header className="px-4 h-12 flex items-center justify-between border-b border-surface-100">
                  <h2 className="section-title flex items-center gap-1.5">
                    <ActivityIcon size={14} className="text-surface-400" /> Recent activity
                  </h2>
                </header>
                {recentActivity.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-surface-400">Activity will appear here as your team works.</p>
                ) : (
                  <div className="divide-y divide-surface-100 max-h-[260px] overflow-y-auto">
                    {recentActivity.slice(0, 6).map((item) => (
                      <div key={item._id} className="flex items-start gap-2.5 px-4 py-2.5">
                        <Avatar user={item.actor} size="xs" />
                        <p className="text-xs text-surface-600 flex-1 leading-snug">
                          <span className="font-medium text-surface-800">{item.actor?.name?.split(' ')[0]}</span>{' '}
                          {item.summary}
                          <span className="block text-2xs text-surface-400 mt-0.5">
                            {item.project?.name ? `${item.project.name} · ` : ''}{relativeTime(item.createdAt)}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      <TaskFormDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        defaults={{ projectId: projects[0]?._id }}
      />
      {selectedTaskId && (
        <TaskPanel taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      )}
    </div>
  );
};

export default DashboardPage;
