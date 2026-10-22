import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  addDays, differenceInCalendarDays, eachDayOfInterval, endOfDay, format, isSameDay, isWeekend,
  startOfDay,
} from 'date-fns';
import {
  ArrowLeft, BarChart3, CalendarDays, CalendarClock, ChevronLeft, ChevronRight,
  Flame, Kanban, Network, Plus,
} from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useMembers } from '../../hooks/useMembers';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Primitives';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/Badge';
import { TaskFormDialog } from '../../components/tasks/TaskFormDialog';
import { TaskPanel } from '../../components/tasks/TaskPanel';
import { projectsApi, tasksApi, taskKeys, projectKeys } from '../../lib/taskApi';
import { isOverdue } from '../../lib/format';

const VIEWS = [
  { label: 'Board', icon: Kanban, path: 'board' },
  { label: 'Calendar', icon: CalendarDays, path: 'calendar' },
  { label: 'Timeline', icon: BarChart3, path: 'gantt' },
  { label: 'Dependencies', icon: Network, path: 'dependencies' },
  { label: 'Critical path', icon: Flame, path: 'critical-path' },
];

const RANGES = [14, 30, 60];

export const GanttViewPage = () => {
  const { projectId } = useParams();
  const { activeWorkspaceId } = useWorkspace();
  const { users } = useMembers();
  const navigate = useNavigate();

  const [rangeDays, setRangeDays] = useState(30);
  const [windowStart, setWindowStart] = useState(() => startOfDay(addDays(new Date(), -7)));
  const [assignee, setAssignee] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: project } = useQuery({
    queryKey: projectKeys.detail(activeWorkspaceId, projectId),
    queryFn: () => projectsApi.get(activeWorkspaceId, projectId),
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: taskKeys.list(activeWorkspaceId, { scope: 'gantt', project: projectId, assignee }),
    queryFn: () => tasksApi.list(activeWorkspaceId, {
      project: projectId,
      assignee: assignee || undefined,
      limit: 200,
      sort: 'startDate',
      dir: 'asc',
    }),
    enabled: Boolean(activeWorkspaceId && projectId),
  });

  const tasks = data?.tasks || [];
  const days = useMemo(
    () => eachDayOfInterval({ start: windowStart, end: addDays(windowStart, rangeDays - 1) }),
    [windowStart, rangeDays],
  );

  const scheduled = tasks.filter((task) => task.startDate || task.dueDate);
  const unscheduled = tasks.filter((task) => !task.startDate && !task.dueDate);
  const today = new Date();

  const barFor = (task) => {
    const start = startOfDay(new Date(task.startDate || task.dueDate));
    const rawEnd = task.dueDate ? endOfDay(new Date(task.dueDate)) : endOfDay(addDays(start, Math.max(0, task.durationDays ?? 0)));
    const end = rawEnd < start ? start : rawEnd;
    const windowEnd = addDays(windowStart, rangeDays - 1);

    if (end < windowStart || start > windowEnd) return null;

    const offset = Math.max(0, differenceInCalendarDays(start, windowStart));
    const span = Math.max(1, differenceInCalendarDays(end, windowStart) - offset + 1);
    return {
      left: (offset / rangeDays) * 100,
      width: Math.min(100 - (offset / rangeDays) * 100, (span / rangeDays) * 100),
      duration: differenceInCalendarDays(end, start) + 1,
      startsBefore: start < windowStart,
      endsAfter: end > windowEnd,
    };
  };

  if (isError) return <ErrorState message="The timeline could not be loaded." onRetry={refetch} />;

  return (
    <div className="page">
      <Link to={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-800 mb-3">
        <ArrowLeft size={13} /> {project?.project?.name || 'Project'}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-[19px] font-semibold text-surface-900 flex items-center gap-2">
            <BarChart3 size={18} className="text-primary-600" /> Timeline
          </h1>
          <p className="text-[13px] text-surface-500 mt-0.5">
            Schedule from {format(windowStart, 'MMM d')} to {format(addDays(windowStart, rangeDays - 1), 'MMM d, yyyy')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="hidden md:flex items-center gap-0.5 bg-surface-100 rounded-lg p-0.5 mr-1">
            {VIEWS.map((view) => (
              <button
                key={view.path}
                type="button"
                onClick={() => navigate(`/projects/${projectId}/${view.path}`)}
                className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium ${
                  view.path === 'gantt' ? 'bg-white text-surface-900 shadow-subtle' : 'text-surface-500 hover:text-surface-800'
                }`}
              >
                <view.icon size={12} /> {view.label}
              </button>
            ))}
          </div>
          <div className="flex items-center border border-surface-200 rounded-lg bg-white shadow-subtle">
            <button type="button" className="px-2 py-1.5 text-surface-500 hover:bg-surface-50" onClick={() => setWindowStart(addDays(windowStart, -rangeDays))} aria-label="Previous period">
              <ChevronLeft size={15} />
            </button>
            <button type="button" className="px-2.5 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-50 border-x border-surface-200" onClick={() => setWindowStart(startOfDay(addDays(new Date(), -7)))}>
              Today
            </button>
            <button type="button" className="px-2 py-1.5 text-surface-500 hover:bg-surface-50" onClick={() => setWindowStart(addDays(windowStart, rangeDays))} aria-label="Next period">
              <ChevronRight size={15} />
            </button>
          </div>
          <select value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value))} className="input input-sm w-auto" aria-label="Timeline range">
            {RANGES.map((range) => <option key={range} value={range}>{range} days</option>)}
          </select>
          <button type="button" className="btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
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
        <span className="text-xs text-surface-400">{scheduled.length} scheduled · {unscheduled.length} without dates</span>
      </div>

      {isLoading ? (
        <div className="card p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-9 w-full" />)}
        </div>
      ) : scheduled.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CalendarClock}
            title="No scheduled tasks yet"
            description="Give tasks a start and due date to see them plotted on the timeline."
            action={<button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}><Plus size={14} /> Add a task</button>}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${Math.max(760, rangeDays * 30 + 260)}px` }}>
              {/* Header */}
              <div className="flex border-b border-surface-200 bg-surface-50 sticky top-0 z-10">
                <div className="w-[260px] flex-shrink-0 px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-surface-500 border-r border-surface-200">
                  Task
                </div>
                <div className="flex flex-1">
                  {days.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={`flex-1 min-w-[26px] text-center py-1.5 border-r border-surface-100 ${
                        isSameDay(day, today) ? 'bg-primary-50' : isWeekend(day) ? 'bg-surface-100/60' : ''
                      }`}
                    >
                      <div className={`text-[9px] uppercase ${isSameDay(day, today) ? 'text-primary-600 font-semibold' : 'text-surface-400'}`}>
                        {format(day, 'EEEEE')}
                      </div>
                      <div className={`text-2xs ${isSameDay(day, today) ? 'text-primary-700 font-bold' : 'text-surface-500'}`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-surface-100">
                {scheduled.map((task) => {
                  const bar = barFor(task);
                  const overdue = isOverdue(task.dueDate, task.status);
                  const isDone = task.status === 'done';
                  return (
                    <div key={task._id} className="flex hover:bg-surface-50/60 transition-colors group">
                      <button
                        type="button"
                        onClick={() => setSelectedTaskId(task._id)}
                        className="w-[260px] flex-shrink-0 px-3 py-2.5 border-r border-surface-200 flex items-center gap-2 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-medium truncate ${isDone ? 'text-surface-400 line-through' : 'text-surface-800 group-hover:text-primary-700'}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <StatusBadge status={task.status} showLabel={false} />
                            {task.startDate && task.dueDate && (
                              <span className="text-[10px] text-surface-400">
                                {format(new Date(task.startDate), 'MMM d')} – {format(new Date(task.dueDate), 'MMM d')}
                              </span>
                            )}
                          </div>
                        </div>
                        {task.assignee && <Avatar user={task.assignee} size="xs" />}
                      </button>

                      <div className="relative flex-1 py-2.5">
                        <div className="absolute inset-0 flex pointer-events-none">
                          {days.map((day) => (
                            <div
                              key={day.toISOString()}
                              className={`flex-1 min-w-[26px] border-r border-surface-50 ${
                                isWeekend(day) ? 'bg-surface-50/70' : ''
                              }`}
                            />
                          ))}
                        </div>
                        {bar && (
                          <button
                            type="button"
                            onClick={() => setSelectedTaskId(task._id)}
                            style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                            className={`absolute top-1/2 -translate-y-1/2 h-6 rounded-md px-2 text-[10px] font-medium text-white
                              flex items-center overflow-hidden shadow-subtle hover:brightness-105
                              ${overdue ? 'bg-red-500' : isDone ? 'bg-emerald-500' : 'bg-primary-500'}`}
                            title={`${task.title} · ${bar.duration} day${bar.duration === 1 ? '' : 's'}`}
                          >
                            <span className="truncate">{task.title}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="card mt-4">
          <header className="px-4 h-11 flex items-center justify-between border-b border-surface-100">
            <h2 className="section-title">Tasks without dates</h2>
            <span className="text-2xs text-surface-400">Set dates in the task panel to schedule them</span>
          </header>
          <div className="divide-y divide-surface-100">
            {unscheduled.slice(0, 6).map((task) => (
              <button
                key={task._id}
                type="button"
                onClick={() => setSelectedTaskId(task._id)}
                className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-surface-50"
              >
                <StatusBadge status={task.status} showLabel={false} />
                <span className="text-[13px] text-surface-700 truncate flex-1">{task.title}</span>
                <span className="text-2xs text-surface-400">{task.project?.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <TaskFormDialog isOpen={createOpen} onClose={() => setCreateOpen(false)} defaults={{ projectId }} />
      {selectedTaskId && <TaskPanel taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}
    </div>
  );
};

export default GanttViewPage;
