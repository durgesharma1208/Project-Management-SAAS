import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BarChart3, CalendarDays, Flame, Info,
  Kanban, Layers, Network, RefreshCw,
} from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { EmptyState, ErrorState, PageSkeleton, StatCard } from '../../components/ui/Primitives';
import { StatusBadge } from '../../components/ui/Badge';
import { TaskPanel } from '../../components/tasks/TaskPanel';
import { criticalPathApi, projectsApi, projectKeys } from '../../lib/taskApi';

const VIEWS = [
  { label: 'Board', icon: Kanban, path: 'board' },
  { label: 'Calendar', icon: CalendarDays, path: 'calendar' },
  { label: 'Timeline', icon: BarChart3, path: 'gantt' },
  { label: 'Dependencies', icon: Network, path: 'dependencies' },
  { label: 'Critical path', icon: Flame, path: 'critical-path' },
];

export const CriticalPathPage = () => {
  const { projectId } = useParams();
  const { activeWorkspaceId } = useWorkspace();
  const navigate = useNavigate();
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const { data: project } = useQuery({
    queryKey: projectKeys.detail(activeWorkspaceId, projectId),
    queryFn: () => projectsApi.get(activeWorkspaceId, projectId),
  });

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: projectKeys.criticalPath(activeWorkspaceId, projectId),
    queryFn: () => criticalPathApi.get(activeWorkspaceId, projectId),
    enabled: Boolean(activeWorkspaceId && projectId),
  });

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message="The critical path could not be calculated." onRetry={refetch} />;

  const {
    totalDuration = 0, criticalPaths = [], criticalTaskIds = [], results = [],
    warnings = [], projectFinish = 0, error, excludedTaskCount = 0, totalTaskCount = 0,
  } = data || {};

  return (
    <div className="page">
      <Link to={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-800 mb-3">
        <ArrowLeft size={13} /> {project?.project?.name || 'Project'}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-[19px] font-semibold text-surface-900 flex items-center gap-2">
            <Flame size={18} className="text-red-500" /> Critical path
          </h1>
          <p className="text-[13px] text-surface-500 mt-0.5">
            Sequence of tasks with zero slack — any delay here delays the whole project.
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
                  view.path === 'critical-path' ? 'bg-white text-surface-900 shadow-subtle' : 'text-surface-500 hover:text-surface-800'
                }`}
              >
                <view.icon size={12} /> {view.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} /> Recalculate
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-red-800">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold">Scheduling error</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <StatCard label="Critical duration" value={`${totalDuration} days`} icon={CalendarDays} tone="primary" hint="Minimum time to finish the plan" />
        <StatCard label="Critical tasks" value={criticalTaskIds.length} icon={Flame} tone="danger" hint="Zero slack tasks" />
        <StatCard label="Critical paths" value={criticalPaths.length} icon={Layers} hint={`${totalTaskCount - excludedTaskCount} of ${totalTaskCount} tasks scheduled`} />
      </div>

      {warnings.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-900">
            <Info size={14} className="text-amber-600" /> Scheduling warnings ({warnings.length})
          </p>
          <ul className="mt-1.5 space-y-0.5 pl-5 list-disc text-xs text-amber-800">
            {warnings.map((warning, index) => <li key={index}>{warning}</li>)}
          </ul>
        </div>
      )}

      {criticalPaths.length > 0 && (
        <section className="card p-4 mb-4">
          <h2 className="section-title mb-3">Critical chain</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {criticalPaths[0].map((taskId, index) => {
              const task = results.find((item) => item.taskId === String(taskId));
              return (
                <span key={taskId} className="flex items-center gap-1.5">
                  {index > 0 && <ArrowRight size={12} className="text-surface-300" />}
                  <button
                    type="button"
                    onClick={() => setSelectedTaskId(String(taskId))}
                    className="px-2 py-1 rounded-md bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 max-w-[220px] truncate"
                  >
                    {task?.title || 'Task'}
                  </button>
                </span>
              );
            })}
          </div>
        </section>
      )}

      <section className="card overflow-hidden">
        <header className="px-4 h-11 flex items-center justify-between border-b border-surface-100">
          <h2 className="section-title">Schedule &amp; slack</h2>
          <span className="text-2xs text-surface-400">Project finish at day {projectFinish}</span>
        </header>
        {results.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="Nothing to schedule yet"
            description="Add tasks with durations or start/due dates, then link them with dependencies to calculate the critical path."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead>
                <tr className="table-head border-b border-surface-200">
                  <th className="px-3 py-2 text-left font-semibold">Task</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Duration</th>
                  <th className="px-3 py-2 text-right font-semibold">ES</th>
                  <th className="px-3 py-2 text-right font-semibold">EF</th>
                  <th className="px-3 py-2 text-right font-semibold">LS</th>
                  <th className="px-3 py-2 text-right font-semibold">LF</th>
                  <th className="px-3 py-2 text-right font-semibold">Slack</th>
                  <th className="px-3 py-2 text-left font-semibold">Critical</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {results.map((row) => (
                  <tr
                    key={row.taskId}
                    className={`cursor-pointer ${row.isCritical ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-surface-50'}`}
                    onClick={() => setSelectedTaskId(row.taskId)}
                  >
                    <td className="px-3 py-2 max-w-[260px]">
                      <p className="font-medium text-surface-900 truncate">{row.title}</p>
                    </td>
                    <td className="px-3 py-2"><StatusBadge status={row.status || 'todo'} /></td>
                    <td className="px-3 py-2 text-right tabular-nums text-surface-600">{row.durationDays}d</td>
                    <td className="px-3 py-2 text-right tabular-nums text-surface-600">{row.es}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-surface-600">{row.ef}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-surface-600">{row.ls}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-surface-600">{row.lf}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`badge ${row.slack === 0 ? 'bg-red-100 text-red-700' : 'bg-surface-100 text-surface-600'}`}>
                        {row.slack}d
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {row.isCritical ? (
                        <span className="badge bg-red-100 text-red-700">Critical</span>
                      ) : (
                        <span className="text-2xs text-surface-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedTaskId && <TaskPanel taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}
    </div>
  );
};

export default CriticalPathPage;
