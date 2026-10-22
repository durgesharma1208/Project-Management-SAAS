import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  startOfMonth, startOfWeek, subMonths,
} from 'date-fns';
import {
  ArrowLeft, BarChart3, CalendarDays, ChevronLeft, ChevronRight, Flame, Kanban, Network, Plus, X,
} from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useMembers } from '../../hooks/useMembers';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Primitives';
import { TaskFormDialog } from '../../components/tasks/TaskFormDialog';
import { TaskPanel } from '../../components/tasks/TaskPanel';
import {
  projectsApi, tasksApi, taskKeys, projectKeys,
} from '../../lib/taskApi';
import { TASK_STATUSES, resolveStatusMeta } from '../../lib/constants';
import { isOverdue } from '../../lib/format';

const VIEWS = [
  { label: 'Board', icon: Kanban, path: 'board' },
  { label: 'Calendar', icon: CalendarDays, path: 'calendar' },
  { label: 'Timeline', icon: BarChart3, path: 'gantt' },
  { label: 'Dependencies', icon: Network, path: 'dependencies' },
  { label: 'Critical path', icon: Flame, path: 'critical-path' },
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const CalendarViewPage = () => {
  const { projectId } = useParams();
  const { activeWorkspaceId } = useWorkspace();
  const { users } = useMembers();
  const navigate = useNavigate();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignee, setAssignee] = useState('');
  const [status, setStatus] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [createDate, setCreateDate] = useState(null);

  const monthStart = startOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const { data: project } = useQuery({
    queryKey: projectKeys.detail(activeWorkspaceId, projectId),
    queryFn: () => projectsApi.get(activeWorkspaceId, projectId),
  });

  const { data: workflow } = useQuery({
    queryKey: ['workflows', activeWorkspaceId, 'project', projectId, 'calendar'],
    queryFn: () => projectsApi.workflow(activeWorkspaceId, projectId),
    enabled: Boolean(activeWorkspaceId && projectId),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: taskKeys.calendar(activeWorkspaceId, {
      project: projectId,
      start: calendarStart.toISOString(),
      end: calendarEnd.toISOString(),
      assignee,
      status,
    }),
    queryFn: () => tasksApi.calendar(activeWorkspaceId, {
      project: projectId,
      startDate: calendarStart.toISOString(),
      endDate: calendarEnd.toISOString(),
      assignee: assignee || undefined,
      status: status || undefined,
    }),
    enabled: Boolean(activeWorkspaceId && projectId),
  });

  const tasks = data?.tasks ?? [];
  const workflowStatuses = workflow?.statuses || workflow?.workflow?.statuses || [];

  // Small month grid (max 6x7 cells) — building the map inline keeps this simple.
  const tasksByDay = new Map();
  days.forEach((day) => tasksByDay.set(format(day, 'yyyy-MM-dd'), []));
  tasks.forEach((task) => {
    if (!task.dueDate) return;
    const key = format(new Date(task.dueDate), 'yyyy-MM-dd');
    if (tasksByDay.has(key)) tasksByDay.get(key).push(task);
  });

  if (isError) return <ErrorState message="The calendar could not be loaded." onRetry={refetch} />;

  return (
    <div className="page">
      <Link to={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-800 mb-3">
        <ArrowLeft size={13} /> {project?.project?.name || 'Project'}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-[19px] font-semibold text-surface-900 flex items-center gap-2">
            <CalendarDays size={18} className="text-primary-600" /> Calendar
          </h1>
          <p className="text-[13px] text-surface-500 mt-0.5">Task due dates for {format(currentDate, 'MMMM yyyy')}.</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="hidden md:flex items-center gap-0.5 bg-surface-100 rounded-lg p-0.5 mr-1">
            {VIEWS.map((view) => (
              <button
                key={view.path}
                type="button"
                onClick={() => navigate(`/projects/${projectId}/${view.path}`)}
                className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium ${
                  view.path === 'calendar' ? 'bg-white text-surface-900 shadow-subtle' : 'text-surface-500 hover:text-surface-800'
                }`}
              >
                <view.icon size={12} /> {view.label}
              </button>
            ))}
          </div>

          <div className="flex items-center border border-surface-200 rounded-lg bg-white shadow-subtle overflow-hidden">
            <button type="button" className="px-2 py-1.5 text-surface-500 hover:bg-surface-50" onClick={() => setCurrentDate(subMonths(currentDate, 1))} aria-label="Previous month">
              <ChevronLeft size={15} />
            </button>
            <span className="px-2 text-xs font-medium text-surface-800 min-w-[110px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button type="button" className="px-2 py-1.5 text-surface-500 hover:bg-surface-50" onClick={() => setCurrentDate(addMonths(currentDate, 1))} aria-label="Next month">
              <ChevronRight size={15} />
            </button>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setCurrentDate(new Date())}>Today</button>
          <button type="button" className="btn-primary btn-sm" onClick={() => setCreateDate(new Date())}>
            <Plus size={13} /> New task
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={assignee} onChange={(event) => setAssignee(event.target.value)} className="input input-sm w-auto" aria-label="Filter by assignee">
          <option value="">Everyone</option>
          <option value="me">Assigned to me</option>
          {users.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="input input-sm w-auto" aria-label="Filter by status">
          <option value="">All statuses</option>
          {TASK_STATUSES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        {(assignee || status) && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => { setAssignee(''); setStatus(''); }}>
            <X size={12} /> Clear
          </button>
        )}
        <span className="text-xs text-surface-400 ml-auto">{tasks.length} scheduled tasks this month</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 border-b border-surface-200 bg-surface-50">
              {WEEKDAYS.map((day) => (
                <div key={day} className="px-2 py-2 text-2xs font-semibold uppercase tracking-wider text-surface-500 text-center">
                  {day}
                </div>
              ))}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-7">
                {Array.from({ length: 35 }).map((_, index) => (
                  <div key={index} className="h-24 border-b border-r border-surface-100 p-2">
                    <Skeleton className="h-3 w-5" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {days.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const dayTasks = tasksByDay.get(key) || [];
                  const inMonth = isSameMonth(day, monthStart);
                  const today = isSameDay(day, new Date());
                  return (
                    <div
                      key={key}
                      className={`group relative min-h-[104px] border-b border-r border-surface-100 p-1.5 ${
                        inMonth ? 'bg-white' : 'bg-surface-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-2xs font-semibold ${
                          today ? 'bg-primary-600 text-white' : inMonth ? 'text-surface-600' : 'text-surface-300'
                        }`}>
                          {format(day, 'd')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCreateDate(day)}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded text-surface-400 hover:text-primary-600 hover:bg-primary-50 transition"
                          aria-label={`Add task due ${format(day, 'MMMM d')}`}
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <div className="mt-1 space-y-1">
                        {dayTasks.slice(0, 3).map((task) => {
                          const meta = resolveStatusMeta(task.status, workflowStatuses);
                          const overdue = isOverdue(task.dueDate, task.status);
                          return (
                            <button
                              key={task._id}
                              type="button"
                              onClick={() => setSelectedTaskId(task._id)}
                              className={`w-full text-left px-1.5 py-1 rounded border text-2xs leading-tight transition-colors truncate ${
                                overdue
                                  ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                                  : task.status === 'done'
                                    ? 'bg-surface-50 border-surface-200 text-surface-400 line-through'
                                    : 'bg-white border-surface-200 text-surface-700 hover:border-surface-300 hover:bg-surface-50'
                              }`}
                              title={`${task.title} · ${meta.label}`}
                            >
                              <span className="inline-flex items-center gap-1 w-full">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                                <span className="truncate">{task.title}</span>
                              </span>
                            </button>
                          );
                        })}
                        {dayTasks.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setSelectedTaskId(dayTasks[3]._id)}
                            className="text-2xs text-surface-500 hover:text-primary-600 px-1"
                          >
                            +{dayTasks.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {!isLoading && tasks.length === 0 && (
        <div className="mt-4">
          <EmptyState
            compact
            icon={CalendarDays}
            title="Nothing scheduled this month"
            description="Add a due date to a task to see it on the calendar."
            action={<button type="button" className="btn-primary btn-sm" onClick={() => setCreateDate(new Date())}><Plus size={13} /> New task</button>}
          />
        </div>
      )}

      <TaskFormDialog
        isOpen={Boolean(createDate)}
        onClose={() => setCreateDate(null)}
        defaults={{ projectId, dueDate: createDate ? format(createDate, 'yyyy-MM-dd') : undefined, status: 'todo' }}
      />
      {selectedTaskId && <TaskPanel taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}
    </div>
  );
};

export default CalendarViewPage;
