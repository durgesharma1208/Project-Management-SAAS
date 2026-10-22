import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Network, ArrowLeft, Plus, AlertCircle, RefreshCw,
  GitCommit, Trash2, CheckCircle2, ShieldAlert
} from 'lucide-react';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkspace } from '../../contexts/WorkspaceContext';
import { dependencyApi, tasksApi, dependencyKeys, taskKeys } from '../../lib/taskApi';
import { PageLoader } from '../../components/ui/Spinner';
import { Dialog } from '../../components/ui/Dialog';
import { Alert, extractError } from '../../components/ui/Alert';

export const DependencyGraphPage = () => {
  const { projectId } = useParams();
  const { activeWorkspaceId } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [addDepOpen, setAddDepOpen] = useState(false);
  const [selectedPred, setSelectedPred] = useState('');
  const [selectedSucc, setSelectedSucc] = useState('');
  const [apiError, setApiError] = useState(null);

  // Load project tasks
  const { data: tasksData } = useQuery({
    queryKey: taskKeys.list(activeWorkspaceId, { project: projectId, limit: 150 }),
    queryFn: () => tasksApi.list(activeWorkspaceId, { project: projectId, limit: 150 }),
    enabled: !!activeWorkspaceId && !!projectId,
  });

  // Load dependency graph
  const { data: graphData, isLoading } = useQuery({
    queryKey: dependencyKeys.graph(activeWorkspaceId, projectId),
    queryFn: () => dependencyApi.graph(activeWorkspaceId, projectId),
    enabled: !!activeWorkspaceId && !!projectId,
  });

  const addDepMutation = useMutation({
    mutationFn: ({ successorId, predecessorId }) =>
      tasksApi.addDependency(activeWorkspaceId, successorId, { predecessorId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dependencyKeys.graph(activeWorkspaceId, projectId) });
      setAddDepOpen(false);
      setSelectedPred('');
      setSelectedSucc('');
      setApiError(null);
    },
    onError: (e) => setApiError(extractError(e)),
  });

  const tasks = tasksData?.tasks || [];
  const rawNodes = graphData?.nodes || [];
  const rawEdges = graphData?.edges || [];

  // Generate react-flow nodes & edges
  const flowNodes = useMemo(() => {
    return rawNodes.map((node, idx) => ({
      id: node.id,
      position: { x: 50 + (idx % 3) * 260, y: 50 + Math.floor(idx / 3) * 120 },
      data: {
        label: (
          <div className={`p-2.5 rounded-lg border text-left shadow-sm ${
            node.isBlocked
              ? 'bg-red-50 border-red-300'
              : node.status === 'done'
              ? 'bg-green-50 border-green-300'
              : 'bg-white border-surface-200'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-surface-900 truncate max-w-[140px]">{node.title}</span>
              {node.isBlocked && <span className="text-[9px] bg-red-100 text-red-700 px-1 rounded font-bold">BLOCKED</span>}
            </div>
            <p className="text-[10px] text-surface-400 capitalize mt-1">Status: {node.status?.replace('_', ' ')}</p>
          </div>
        ),
      },
    }));
  }, [rawNodes]);

  const flowEdges = useMemo(() => {
    return rawEdges.map((e) => ({
      id: e.id,
      source: e.predecessor,
      target: e.successor,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
      style: { stroke: '#6366f1', strokeWidth: 2 },
      animated: true,
    }));
  }, [rawEdges]);

  if (isLoading) return <PageLoader />;

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
              <Network className="text-primary-600" size={22} />
              Task Dependencies (Finish-to-Start)
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Visualize task blockers, predecessor/successor links with real-time cycle detection.
            </p>
          </div>
        </div>

        <button
          onClick={() => setAddDepOpen(true)}
          className="btn-primary btn-sm flex items-center gap-1.5"
        >
          <Plus size={14} /> Link Tasks
        </button>
      </div>

      <Alert type="error" message={apiError} dismissible onDismiss={() => setApiError(null)} />

      {/* React Flow Graph Area */}
      <div className="card h-[600px] relative overflow-hidden bg-surface-50/50">
        {rawNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-surface-400">
            <GitCommit size={40} className="mb-2 text-surface-300" />
            <p className="text-sm">No tasks found in this project.</p>
          </div>
        ) : (
          <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
            <Background gap={16} size={1} color="#cbd5e1" />
            <Controls />
            <MiniMap />
          </ReactFlow>
        )}
      </div>

      {/* Link Tasks Dialog */}
      <Dialog
        isOpen={addDepOpen}
        onClose={() => setAddDepOpen(false)}
        title="Add Task Dependency"
        footer={
          <>
            <button className="btn-secondary btn-sm" onClick={() => setAddDepOpen(false)}>Cancel</button>
            <button
              className="btn-primary btn-sm"
              disabled={!selectedPred || !selectedSucc || selectedPred === selectedSucc}
              onClick={() => addDepMutation.mutate({ successorId: selectedSucc, predecessorId: selectedPred })}
            >
              Link Tasks
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Predecessor (Must finish first)</label>
            <select
              value={selectedPred}
              onChange={(e) => setSelectedPred(e.target.value)}
              className="input text-xs"
            >
              <option value="">Select predecessor task...</option>
              {tasks.map((t) => (
                <option key={t._id} value={t._id}>{t.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Successor (Blocked until predecessor finishes)</label>
            <select
              value={selectedSucc}
              onChange={(e) => setSelectedSucc(e.target.value)}
              className="input text-xs"
            >
              <option value="">Select successor task...</option>
              {tasks.map((t) => (
                <option key={t._id} value={t._id}>{t.title}</option>
              ))}
            </select>
          </div>

          <p className="text-[11px] text-surface-400">
            Backend topological sort rejects circular links automatically (e.g. A → B → A).
          </p>
        </div>
      </Dialog>
    </div>
  );
};
