import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import {
  ArrowLeft, BarChart3, CalendarDays, Flame, Kanban, Network, Plus, Search, X, User2,
} from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useMembers } from '../../hooks/useMembers';
import { useToast } from '../../components/ui/Toast';
import { Avatar } from '../../components/ui/Avatar';
import { PriorityBadge, LabelBadge } from '../../components/ui/Badge';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Primitives';
import { TaskFormDialog } from '../../components/tasks/TaskFormDialog';
import { TaskPanel } from '../../components/tasks/TaskPanel';
import {
  projectsApi, tasksApi, workflowsApi, taskKeys, projectKeys, dashboardKeys, workflowKeys,
} from '../../lib/taskApi';
import { TASK_STATUSES, TASK_PRIORITIES } from '../../lib/constants';
import { dueLabel, isOverdue } from '../../lib/format';
import { extractError } from '../../components/ui/Alert';

const VIEWS = [
  { label: 'Board', icon: Kanban, path: 'board' },
  { label: 'Calendar', icon: CalendarDays, path: 'calendar' },
  { label: 'Timeline', icon: BarChart3, path: 'gantt' },
  { label: 'Dependencies', icon: Network, path: 'dependencies' },
  { label: 'Critical path', icon: Flame, path: 'critical-path' },
];

const TaskCard = ({ task, index, onOpen }) => {
  const overdue = isOverdue(task.dueDate, task.status);
  const subtaskTotal = task.subtasks?.length || 0;
  const subtaskDone = task.subtasks?.filter((s) => s.isCompleted).length || 0;

  return (
    <Draggable draggableId={task._id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onOpen(task._id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpen(task._id);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Open task ${task.title}`}
          className={`bg-white border rounded-lg p-3 cursor-pointer transition-shadow
            ${snapshot.isDragging ? 'shadow-elevated border-primary-300 rotate-[0.5deg]' : 'border-surface-200 shadow-subtle hover:border-surface-300'}`}
        >
          {(task.labels?.length > 0) && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {task.labels.slice(0, 2).map((label) => <LabelBadge key={label} label={label} />)}
              {task.labels.length > 2 && (
                <span className="badge bg-surface-100 text-surface-500">+{task.labels.length - 2}</span>
              )}
            </div>
          )}

          <p className="text-[13px] font-medium text-surface-900 leading-snug line-clamp-2">{task.title}</p>

          <div className="flex items-center justify-between gap-2 mt-2.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <PriorityBadge priority={task.priority} showLabel={false} />
              {task.dueDate && (
                <span className={`text-2xs flex items-center gap-0.5 whitespace-nowrap ${overdue ? 'text-red-600 font-medium' : 'text-surface-400'}`}>
                  <CalendarDays size={10} /> {dueLabel(task.dueDate)}
                </span>
              )}
            </div>
            {task.assignee ? (
              <Avatar user={task.assignee} size="xs" />
            ) : (
              <span className="w-5 h-5 rounded-full border border-dashed border-surface-300 flex items-center justify-center" title="Unassigned">
                <User2 size={9} className="text-surface-400" />
              </span>
            )}
          </div>

          {subtaskTotal > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1 rounded-full bg-surface-100 overflow-hidden">
                <div
                  className="h-full bg-primary-400 rounded-full"
                  style={{ width: `${(subtaskDone / subtaskTotal) * 100}%` }}
                />
              </div>
              <span className="text-2xs text-surface-400 tabular-nums">{subtaskDone}/{subtaskTotal}</span>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

const InlineTaskComposer = ({ status, projectId, workspaceId, onCreated }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: () => tasksApi.create(workspaceId, { title: title.trim(), project: projectId, status }),
    onSuccess: () => {
      setTitle('');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: taskKeys.all(workspaceId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.all(workspaceId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.workspace(workspaceId) });
      toast.success('Task created');
      onCreated?.();
    },
    onError: (error) => toast.error(extractError(error)),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 mt-1 rounded-md text-xs text-surface-500 hover:bg-white hover:text-surface-800 transition-colors"
      >
        <Plus size={13} /> Add task
      </button>
    );
  }

  return (
    <form
      className="mt-1 bg-white border border-primary-300 rounded-lg p-2 shadow-card"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim()) mutation.mutate();
      }}
    >
      <textarea
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (title.trim()) mutation.mutate();
          }
          if (event.key === 'Escape') { setOpen(false); setTitle(''); }
        }}
        rows={2}
        autoFocus
        placeholder="Task title…"
        className="w-full text-[13px] text-surface-900 resize-none focus:outline-none placeholder:text-surface-400"
        aria-label="New task title"
      />
      <div className="flex items-center gap-1.5 mt-1.5">
        <button type="submit" className="btn-primary btn-sm" disabled={!title.trim() || mutation.isPending}>
          Add task
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => { setOpen(false); setTitle(''); }}>
          <X size={13} />
        </button>
      </div>
    </form>
  );
};

export const KanbanBoardPage = () => {
  const { projectId } = useParams();
  const { activeWorkspaceId } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { users } = useMembers();

  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');

  const filters = useMemo(() => ({
    scope: 'board',
    project: projectId,
    assignee: assignee || undefined,
    priority: priority || undefined,
    search: search.trim() || undefined,
    limit: 200,
  }), [projectId, assignee, priority, search]);

  const { data: projectData } = useQuery({
    queryKey: projectKeys.detail(activeWorkspaceId, projectId),
    queryFn: () => projectsApi.get(activeWorkspaceId, projectId),
    enabled: Boolean(activeWorkspaceId && projectId),
  });

  const { data: workflowData } = useQuery({
    queryKey: workflowKeys.project(activeWorkspaceId, projectId),
    queryFn: () => workflowsApi.projectWorkflow(activeWorkspaceId, projectId),
    enabled: Boolean(activeWorkspaceId && projectId),
  });

  const { data: taskData, isLoading, isError, refetch } = useQuery({
    queryKey: taskKeys.list(activeWorkspaceId, filters),
    queryFn: () => tasksApi.list(activeWorkspaceId, filters),
    enabled: Boolean(activeWorkspaceId && projectId),
  });

  const columns = useMemo(() => {
    const statuses = workflowData?.workflow?.statuses;
    if (statuses?.length) {
      return [...statuses]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((status) => ({ id: status.id, label: status.name, color: status.color }));
    }
    return TASK_STATUSES;
  }, [workflowData]);

  const tasks = taskData?.tasks || [];
  const project = projectData?.project;

  const moveMutation = useMutation({
    mutationFn: ({ taskId, status }) => tasksApi.move(activeWorkspaceId, taskId, { status }),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.list(activeWorkspaceId, filters) });
      const previous = queryClient.getQueryData(taskKeys.list(activeWorkspaceId, filters));
      queryClient.setQueryData(taskKeys.list(activeWorkspaceId, filters), (old) => {
        if (!old?.tasks) return old;
        return { ...old, tasks: old.tasks.map((task) => (task._id === taskId ? { ...task, status } : task)) };
      });
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(taskKeys.list(activeWorkspaceId, filters), context.previous);
      toast.error(extractError(error));
    },
    onSuccess: () => toast.success('Task moved'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all(activeWorkspaceId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.workspace(activeWorkspaceId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.all(activeWorkspaceId) });
    },
  });

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    moveMutation.mutate({ taskId: draggableId, status: destination.droppableId });
  };

  const activeFilters = Boolean(assignee || priority || search);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Board toolbar */}
      <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-surface-200 bg-white/70 backdrop-blur flex-shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/projects/${projectId}`} className="btn-icon" aria-label="Back to project">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-lg leading-none">{project?.emoji || '📋'}</span>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-surface-900 truncate">{project?.name || 'Board'}</h1>
            <p className="text-2xs text-surface-400">
              {tasks.length} task{tasks.length === 1 ? '' : 's'} on this board
            </p>
          </div>

          <div className="flex-1" />

          <div className="hidden md:flex items-center gap-1 bg-surface-100 rounded-lg p-0.5">
            {VIEWS.map((view) => (
              <button
                key={view.path}
                type="button"
                onClick={() => navigate(`/projects/${projectId}/${view.path}`)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${view.path === 'board' ? 'bg-white text-surface-900 shadow-subtle' : 'text-surface-500 hover:text-surface-800'}`}
              >
                <view.icon size={13} /> {view.label}
              </button>
            ))}
          </div>

          <button type="button" className="btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> New task
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks…"
              className="input input-sm pl-7 w-44"
              aria-label="Search tasks on the board"
            />
          </div>
          <select value={assignee} onChange={(event) => setAssignee(event.target.value)} className="input input-sm w-auto" aria-label="Filter by assignee">
            <option value="">Everyone</option>
            <option value="me">Assigned to me</option>
            {users.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
          </select>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} className="input input-sm w-auto" aria-label="Filter by priority">
            <option value="">All priorities</option>
            {TASK_PRIORITIES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          {activeFilters && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => { setSearch(''); setAssignee(''); setPriority(''); }}
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 sm:p-5 min-h-0">
        {isError ? (
          <ErrorState message="The board could not be loaded." onRetry={refetch} />
        ) : isLoading ? (
          <div className="flex gap-3 h-full">
            {columns.map((column) => (
              <div key={column.id} className="w-[280px] flex-shrink-0 space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        ) : tasks.length === 0 && activeFilters ? (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              icon={Search}
              title="No tasks match these filters"
              description="Clear the search or filters to see the whole board."
              action={
                <button type="button" className="btn-secondary btn-sm" onClick={() => { setSearch(''); setAssignee(''); setPriority(''); }}>
                  Clear filters
                </button>
              }
            />
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-3 h-full items-start">
              {columns.map((column) => {
                const columnTasks = tasks.filter((task) => task.status === column.id);
                return (
                  <section key={column.id} className="w-[280px] flex-shrink-0 flex flex-col max-h-full">
                    <header className="flex items-center gap-2 px-1 pb-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: column.color }} />
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-surface-600">{column.label}</h2>
                      <span className="badge bg-surface-100 text-surface-500 ml-auto">{columnTasks.length}</span>
                    </header>

                    <Droppable droppableId={column.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 overflow-y-auto rounded-xl p-2 space-y-2 transition-colors
                            ${snapshot.isDraggingOver ? 'bg-primary-50 ring-2 ring-primary-200' : 'bg-surface-100/70'}`}
                        >
                          {columnTasks.map((task, index) => (
                            <TaskCard key={task._id} task={task} index={index} onOpen={setSelectedTaskId} />
                          ))}
                          {provided.placeholder}
                          {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                            <p className="text-2xs text-surface-400 text-center py-3">Drop tasks here</p>
                          )}
                          <InlineTaskComposer
                            status={column.id}
                            projectId={projectId}
                            workspaceId={activeWorkspaceId}
                          />
                        </div>
                      )}
                    </Droppable>
                  </section>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </div>

      <TaskFormDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        defaults={{ projectId }}
      />
      {selectedTaskId && <TaskPanel taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}
    </div>
  );
};

export default KanbanBoardPage;
