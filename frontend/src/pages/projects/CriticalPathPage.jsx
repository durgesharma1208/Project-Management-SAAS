import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Flame, ArrowLeft, AlertTriangle, CheckCircle2, Clock,
  TrendingUp, Calendar, Info, Layers
} from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { criticalPathApi, criticalPathKeys } from '../../lib/taskApi';
import { PageLoader } from '../../components/ui/Spinner';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';

export const CriticalPathPage = () => {
  const { projectId } = useParams();
  const { activeWorkspaceId } = useWorkspace();
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useQuery({
    queryKey: criticalPathKeys.project(activeWorkspaceId, projectId),
    queryFn: () => criticalPathApi.get(activeWorkspaceId, projectId),
    enabled: !!activeWorkspaceId && !!projectId,
  });

  if (isLoading) return <PageLoader />;

  const {
    projectName,
    projectFinish = 0,
    totalDuration = 0,
    criticalPaths = [],
    criticalTaskIds = [],
    results = [],
    warnings = [],
    status,
    error,
  } = data || {};

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/projects/${projectId}`)} className="btn-ghost p-2">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-surface-900 flex items-center gap-2">
              <Flame className="text-red-500" size={22} />
              Critical Path Analysis (CPM)
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Topological scheduling engine: Earliest/Latest Start/Finish & Float/Slack.
            </p>
          </div>
        </div>

        <button onClick={() => refetch()} className="btn-secondary btn-sm flex items-center gap-1.5">
          Recalculate CPM
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm flex items-start gap-3">
          <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-semibold">Scheduling Error</p>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 space-y-1">
          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Calculated Duration</span>
          <div className="text-2xl font-black text-surface-900 flex items-baseline gap-1">
            {totalDuration} <span className="text-xs font-medium text-surface-500">calendar days</span>
          </div>
          <p className="text-[11px] text-surface-400">Total minimum project span to completion</p>
        </div>

        <div className="card p-5 space-y-1">
          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Critical Tasks Count</span>
          <div className="text-2xl font-black text-red-600 flex items-baseline gap-1">
            {criticalTaskIds.length} <span className="text-xs font-medium text-surface-500">tasks (Zero Slack)</span>
          </div>
          <p className="text-[11px] text-surface-400">Any delay in these directly delays project delivery</p>
        </div>

        <div className="card p-5 space-y-1">
          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Identified Critical Paths</span>
          <div className="text-2xl font-black text-primary-600 flex items-baseline gap-1">
            {criticalPaths.length} <span className="text-xs font-medium text-surface-500">longest sequence(s)</span>
          </div>
          <p className="text-[11px] text-surface-400">Continuous chain from start to finish</p>
        </div>
      </div>

      {/* Warnings Banner if any */}
      {warnings.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 text-xs space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <Info size={14} className="text-amber-600" /> Scheduling Model Warnings ({warnings.length}):
          </p>
          <ul className="list-disc pl-5 space-y-0.5 text-amber-800">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Task Schedule Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-surface-100 bg-surface-50">
          <h3 className="font-semibold text-sm text-surface-800">CPM Schedule & Slack Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-50/50 text-surface-500 font-semibold border-b border-surface-100">
              <tr>
                <th className="p-3">Task Name</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Earliest Start (ES)</th>
                <th className="p-3">Earliest Finish (EF)</th>
                <th className="p-3">Latest Start (LS)</th>
                <th className="p-3">Latest Finish (LF)</th>
                <th className="p-3">Slack / Float</th>
                <th className="p-3">Critical Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {results.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center p-8 text-surface-400">No tasks computed for this project.</td>
                </tr>
              ) : (
                results.map((r) => (
                  <tr key={r.taskId} className={r.isCritical ? 'bg-red-50/40 font-medium' : 'hover:bg-surface-50'}>
                    <td className="p-3 text-surface-900 font-medium max-w-[200px] truncate" title={r.title}>
                      {r.title}
                    </td>
                    <td className="p-3 text-surface-600">{r.durationDays}d</td>
                    <td className="p-3 text-surface-600">Day {r.es}</td>
                    <td className="p-3 text-surface-600">Day {r.ef}</td>
                    <td className="p-3 text-surface-600">Day {r.ls}</td>
                    <td className="p-3 text-surface-600">Day {r.lf}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        r.slack === 0 ? 'bg-red-100 text-red-700' : 'bg-surface-100 text-surface-700'
                      }`}>
                        {r.slack} days
                      </span>
                    </td>
                    <td className="p-3">
                      {r.isCritical ? (
                        <span className="badge bg-red-100 text-red-800 border border-red-200">CRITICAL</span>
                      ) : (
                        <span className="badge bg-surface-100 text-surface-500">Non-Critical</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
