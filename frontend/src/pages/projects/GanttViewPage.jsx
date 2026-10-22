import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart2, ArrowLeft, Calendar as CalendarIcon, Clock,
  AlertTriangle, CheckCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { format, differenceInDays, addDays, isPast } from 'date-fns';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { tasksApi, taskKeys } from '../../lib/taskApi';
import { PageLoader } from '../../components/ui/Spinner';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';

export const GanttViewPage = () => {
  const { projectId } = useParams();
  const { activeWorkspaceId } = useWorkspace();
  const navigate = useNavigate();

  const [timeframeDays, setTimeframeDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: taskKeys.list(activeWorkspaceId, { project: projectId, limit: 100 }),
    queryFn: () => tasksApi.list(activeWorkspaceId, { project: projectId, limit: 100 }),
    enabled: !!activeWorkspaceId && !!projectId,
  });

  const tasks = data?.tasks || [];

  // Filter tasks with either start or due date
  const scheduledTasks = tasks.filter((t) => t.startDate || t.dueDate);

  // Timeline boundaries
  const today = new Date();
  const timelineStart = addDays(today, -5);
  const timelineDays = Array.from({ length: timeframeDays }, (_, i) => addDays(timelineStart, i));

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/projects/${projectId}`)} className="btn-ghost p-2">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-surface-900 flex items-center gap-2">
              <BarChart2 className="text-primary-600 rotate-90" size={22} />
              Interactive Gantt Timeline
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Visual project schedule, task duration spans, and sequence tracking.
            </p>
          </div>
        </div>

        {/* View Range */}
        <div className="flex gap-1.5 bg-surface-100 p-1 rounded-lg text-xs">
          {[15, 30, 60].map((days) => (
            <button
              key={days}
              onClick={() => setTimeframeDays(days)}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                timeframeDays === days ? 'bg-white text-primary-700 shadow-sm' : 'text-surface-600 hover:text-surface-900'
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {scheduledTasks.length === 0 ? (
        <div className="card text-center py-16">
          <Clock size={40} className="mx-auto text-surface-300 mb-3" />
          <h3 className="text-base font-semibold text-surface-800">No Scheduled Tasks Yet</h3>
          <p className="text-sm text-surface-500 max-w-md mx-auto mt-1">
            Add start and due dates to your tasks to see them plotted on this Gantt timeline.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto shadow-sm">
          <div className="min-w-[900px]">
            {/* Header Timeline Days */}
            <div className="flex border-b border-surface-200 bg-surface-50 text-[11px] font-semibold text-surface-600 sticky top-0">
              <div className="w-64 p-3 border-r border-surface-200 flex-shrink-0">Task Details</div>
              <div className="flex-1 flex">
                {timelineDays.map((d) => (
                  <div
                    key={d.toISOString()}
                    className={`flex-1 text-center py-2 border-r border-surface-100 ${
                      format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd') ? 'bg-primary-50 text-primary-700 font-bold' : ''
                    }`}
                  >
                    <div>{format(d, 'EEE')}</div>
                    <div>{format(d, 'd')}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Task Rows */}
            <div className="divide-y divide-surface-100">
              {scheduledTasks.map((t) => {
                const start = t.startDate ? new Date(t.startDate) : t.dueDate ? new Date(t.dueDate) : today;
                const end = t.dueDate ? new Date(t.dueDate) : addDays(start, t.durationDays || 1);

                const startOffset = Math.max(0, differenceInDays(start, timelineStart));
                const spanDays = Math.max(1, differenceInDays(end, start) + 1);

                const leftPct = (startOffset / timeframeDays) * 100;
                const widthPct = Math.min(100 - leftPct, (spanDays / timeframeDays) * 100);

                const isOverdue = t.dueDate && isPast(new Date(t.dueDate)) && t.status !== 'done';

                return (
                  <div key={t._id} className="flex items-center hover:bg-surface-50/70 transition-colors h-14">
                    {/* Task Info Column */}
                    <div className="w-64 p-3 border-r border-surface-200 flex-shrink-0 flex items-center justify-between">
                      <span className="text-xs font-semibold text-surface-800 truncate" title={t.title}>
                        {t.title}
                      </span>
                      <StatusBadge status={t.status} showLabel={false} />
                    </div>

                    {/* Timeline Bar Space */}
                    <div className="flex-1 relative h-full flex items-center px-1">
                      {leftPct >= 0 && leftPct < 100 && (
                        <div
                          className={`absolute h-7 rounded-md shadow-sm flex items-center px-2 text-[11px] font-medium text-white transition-all overflow-hidden ${
                            isOverdue
                              ? 'bg-red-500'
                              : t.status === 'done'
                              ? 'bg-green-600'
                              : 'bg-primary-600'
                          }`}
                          style={{
                            left: `${Math.max(0, leftPct)}%`,
                            width: `${Math.max(3, widthPct)}%`,
                          }}
                          title={`${t.title} (${spanDays} days)`}
                        >
                          <span className="truncate">{t.title}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
