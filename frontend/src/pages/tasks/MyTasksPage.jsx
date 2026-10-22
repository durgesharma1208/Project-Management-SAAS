import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isToday, isTomorrow, addDays } from 'date-fns';
import { ArrowRight, CheckSquare, ListFilter, Plus, Search } from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../components/ui/Toast';
import { EmptyState, ErrorState, PageHeader, PageSkeleton } from '../../components/ui/Primitives';
import { TaskListItem } from '../../components/tasks/TaskListItem';
import { TaskFormDialog } from '../../components/tasks/TaskFormDialog';
import { TaskPanel } from '../../components/tasks/TaskPanel';
import { tasksApi, taskKeys, dashboardKeys, projectKeys } from '../../lib/taskApi';
import { TASK_STATUSES } from '../../lib/constants';
import { isOverdue } from '../../lib/format';
import { extractError } from '../../components/ui/Alert';

const GROUPS = [
  { id: 'overdue', label: 'Overdue', tone: 'text-red-600' },
  { id: 'today', label: 'Today', tone: 'text-amber-600' },
  { id: 'week', label: 'Next 7 days', tone: 'text-surface-700' },
  { id: 'later', label: 'Later', tone: 'text-surface-700' },
  { id: 'none', label: 'No due date', tone: 'text-surface-500' },
];

const groupForTask = (task) => {
  if (!task.dueDate) return 'none';
  const due = new Date(task.dueDate);
  if (isOverdue(task.dueDate, task.status)) return 'overdue';
  if (isToday(due)) return 'today';
  if (isTomorrow(due) || due <= addDays(new Date(), 7)) return 'week';
  return 'later';
};

export const MyTasksPage = () => {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: taskKeys.list(activeWorkspaceId, { scope: 'my-tasks', search, status }),
    queryFn: () => tasksApi.list(activeWorkspaceId, {
      myTasks: 'true',
      search: search || undefined,
      status: status || undefined,
      limit: 200,
      sort: 'dueDate',
      dir: 'asc',
    }),
    enabled: Boolean(activeWorkspaceId),
  });

  const tasks = useMemo(() => data?.tasks ?? [], [data]);

  const completeMutation = useMutation({
    mutationFn: (task) => tasksApi.update(activeWorkspaceId, task._id, {
      status: task.status === 'done' ? 'todo' : 'done',
    }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all(activeWorkspaceId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.workspace(activeWorkspaceId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.all(activeWorkspaceId) });
      toast.success(task.status === 'done' ? 'Task completed' : 'Task reopened');
    },
    onError: (error) => toast.error(extractError(error)),
  });

  const grouped = useMemo(() => {
    const buckets = Object.fromEntries(GROUPS.map((group) => [group.id, []]));
    tasks.forEach((task) => {
      if (task.status === 'done') return;
      buckets[groupForTask(task)].push(task);
    });
    return buckets;
  }, [tasks]);

  const openTasks = tasks.filter((task) => task.status !== 'done');
  const doneTasks = tasks.filter((task) => task.status === 'done');

  return (
    <div className="page">
      <PageHeader
        title="My Tasks"
        description={`${openTasks.length} open ${openTasks.length === 1 ? 'task' : 'tasks'} assigned to you`}
        actions={
          <>
            <Link to="/tasks/list" className="btn-secondary">
              <ListFilter size={14} /> All tasks
            </Link>
            <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> New task
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your tasks…"
            className="input pl-8"
            aria-label="Search my tasks"
          />
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="input w-auto"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {TASK_STATUSES.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <PageSkeleton cards={2} />
      ) : isError ? (
        <ErrorState message="Your tasks could not be loaded." onRetry={refetch} />
      ) : openTasks.length === 0 && doneTasks.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CheckSquare}
            title={search || status ? 'No tasks match your search' : 'Nothing assigned to you'}
            description={
              search || status
                ? 'Try a different keyword or clear the status filter.'
                : 'Tasks assigned to you across all projects will show up here.'
            }
            action={
              search || status ? (
                <button type="button" className="btn-secondary" onClick={() => { setSearch(''); setStatus(''); }}>
                  Clear filters
                </button>
              ) : (
                <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
                  <Plus size={14} /> Create a task
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {GROUPS.map((group) => {
            const groupTasks = grouped[group.id];
            if (!groupTasks.length) return null;
            return (
              <section key={group.id} className="card overflow-hidden">
                <header className="flex items-center gap-2 px-4 h-11 border-b border-surface-100">
                  <h2 className={`section-title ${group.tone}`}>{group.label}</h2>
                  <span className="badge bg-surface-100 text-surface-500">{groupTasks.length}</span>
                </header>
                <div className="divide-y divide-surface-100">
                  {groupTasks.map((task) => (
                    <TaskListItem
                      key={task._id}
                      task={task}
                      showProject
                      onOpen={setSelectedTaskId}
                      onToggleComplete={(item) => completeMutation.mutate(item)}
                      isToggling={completeMutation.isPending && completeMutation.variables?._id === task._id}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {doneTasks.length > 0 && (
            <section className="card overflow-hidden">
              <header className="flex items-center gap-2 px-4 h-11 border-b border-surface-100">
                <h2 className="section-title text-surface-500">Recently completed</h2>
                <span className="badge bg-surface-100 text-surface-500">{doneTasks.length}</span>
              </header>
              <div className="divide-y divide-surface-100">
                {doneTasks.slice(0, 8).map((task) => (
                  <TaskListItem
                    key={task._id}
                    task={task}
                    showProject
                    onOpen={setSelectedTaskId}
                    onToggleComplete={(item) => completeMutation.mutate(item)}
                  />
                ))}
              </div>
              <Link to="/tasks/list" className="flex items-center justify-center gap-1 py-2.5 text-xs font-medium text-primary-600 hover:bg-primary-50/50">
                See all tasks <ArrowRight size={12} />
              </Link>
            </section>
          )}
        </div>
      )}

      <TaskFormDialog isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      {selectedTaskId && <TaskPanel taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}
    </div>
  );
};

export default MyTasksPage;
