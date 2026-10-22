import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock,
  ArrowLeft, CheckCircle2, AlertCircle, Filter
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
  isToday, isPast
} from 'date-fns';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { tasksApi, taskKeys } from '../../lib/taskApi';
import { PageLoader } from '../../components/ui/Spinner';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';

export const CalendarViewPage = () => {
  const { projectId } = useParams();
  const { activeWorkspaceId } = useWorkspace();
  const navigate = useNavigate();

  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const { data, isLoading } = useQuery({
    queryKey: taskKeys.calendar(activeWorkspaceId, {
      project: projectId,
      startDate: calendarStart.toISOString(),
      endDate: calendarEnd.toISOString(),
    }),
    queryFn: () => tasksApi.calendar(activeWorkspaceId, {
      project: projectId,
      startDate: calendarStart.toISOString(),
      endDate: calendarEnd.toISOString(),
    }),
    enabled: !!activeWorkspaceId,
  });

  const tasks = data?.tasks || [];

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const jumpToday = () => setCurrentDate(new Date());

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {projectId && (
            <button onClick={() => navigate(`/projects/${projectId}`)} className="btn-ghost p-2">
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-surface-900 flex items-center gap-2">
              <CalendarIcon className="text-primary-600" size={22} />
              Calendar Timeline
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Scheduled task deadlines, start dates, and time allocations.
            </p>
          </div>
        </div>

        {/* Navigation controls */}
        <div className="flex items-center gap-2 bg-white border border-surface-200 rounded-lg p-1 shadow-sm">
          <button onClick={jumpToday} className="btn-secondary btn-sm text-xs py-1 px-2.5">
            Today
          </button>
          <div className="h-4 w-px bg-surface-200" />
          <button onClick={prevMonth} className="p-1 hover:bg-surface-100 rounded text-surface-600">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-surface-800 min-w-[120px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-surface-100 rounded text-surface-600">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="card overflow-hidden">
        {/* Day Header */}
        <div className="grid grid-cols-7 border-b border-surface-200 bg-surface-50 text-center py-2 text-xs font-semibold text-surface-500">
          <div>SUN</div>
          <div>MON</div>
          <div>TUE</div>
          <div>WED</div>
          <div>THU</div>
          <div>FRI</div>
          <div>SAT</div>
        </div>

        {/* Days Matrix */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-surface-100 min-h-[640px]">
          {days.map((day) => {
            const dayTasks = tasks.filter((t) => {
              const due = t.dueDate ? new Date(t.dueDate) : null;
              const start = t.startDate ? new Date(t.startDate) : null;
              return (due && isSameDay(due, day)) || (start && isSameDay(start, day));
            });

            const isCurrentMonth = isSameMonth(day, monthStart);
            const isTodayDate = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`p-2 flex flex-col transition-colors ${
                  !isCurrentMonth ? 'bg-surface-50/40 text-surface-400' : 'bg-white'
                } ${isTodayDate ? 'bg-primary-50/20' : ''}`}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span
                    className={`text-xs font-semibold rounded-full w-6 h-6 flex items-center justify-center ${
                      isTodayDate
                        ? 'bg-primary-600 text-white'
                        : isCurrentMonth ? 'text-surface-700' : 'text-surface-400'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[10px] text-surface-400 font-medium">
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                {/* Day Task Pills */}
                <div className="space-y-1 overflow-y-auto max-h-24 scrollbar-none flex-1">
                  {dayTasks.map((t) => {
                    const isOverdue = t.dueDate && isPast(new Date(t.dueDate)) && t.status !== 'done';
                    return (
                      <div
                        key={t._id}
                        className={`text-[11px] p-1.5 rounded border leading-tight transition-transform hover:scale-[1.02] cursor-pointer ${
                          isOverdue
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : t.status === 'done'
                            ? 'bg-green-50 border-green-200 text-green-700 line-through'
                            : 'bg-surface-50 border-surface-200 text-surface-800'
                        }`}
                        title={t.title}
                      >
                        <p className="font-medium truncate">{t.title}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
