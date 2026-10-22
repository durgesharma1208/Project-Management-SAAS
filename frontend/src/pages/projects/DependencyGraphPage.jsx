import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReactFlow, Background, Controls, MiniMap, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft, BarChart3, CalendarDays, Flame, GitCommit, Kanban, Link2, Network, Plus, Trash2, X,
} from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../components/ui/Toast';
import { Dialog } from '../../components/ui/Dialog';
import { FormField, Select } from '../../components/ui/Form';
import { EmptyState, ErrorState, PageSkeleton, StatCard } from '../../components/ui/Primitives';
import {
  projectsApi, tasksApi, dependencyApi, taskKeys, projectKeys,
} from '../../lib/taskApi';
import { extractError } from '../../components/ui/Alert';

const VIEWS = [
  { label: 'Board', icon: Kanban, path: 'board' },
  { label: 'Calendar', icon: CalendarDays, path: 'calendar' },
  { label: 'Timeline', icon: BarChart3, path: 'gantt' },
  { label: 'Dependencies', icon: Network, path: 'dependencies' },
  { label: 'Critical path', icon: Flame, path: 'critical-path' },
];

export const DependencyGraphPage = () => {
  const { projectId } = useParams();
  const { activeWorkspaceId } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [predecessorId, setPredecessorId] = useState('');
  const [successorId, setSuccessorId] = useState('');

  const { data: project } = useQuery({
    queryKey: projectKeys.detail(activeWorkspaceId, projectId),
    queryFn: () => projectsApi.get(activeWorkspaceId, projectId),
  });

  const { data: taskData } = useQuery({
    queryKey: taskKeys.list(activeWorkspaceId, { scope: 'dependencies', project: projectId }),
    queryFn: () => tasksApi.list(activeWorkspaceId, { project: projectId, limit: 200 }),
    enabled: Boolean(activeWorkspaceId && projectId),
  });

  const { data: graph, isLoading, isError, refetch } = useQuery({
    queryKey: projectKeys.graph(activeWorkspaceId, projectId),
    queryFn: () => dependencyApi.graph(activeWorkspaceId, projectId),
    enabled: Boolean(activeWorkspaceId && projectId),
  });

  const tasks = taskData?.tasks || [];
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: projectKeys.graph(activeWorkspaceId, projectId) });
    queryClient.invalidateQueries({ queryKey: taskKeys.all(activeWorkspaceId) });
  };

  const addMutation = useMutation({
    mutationFn: () => tasksApi.dependencies.add(activeWorkspaceId, successorId, { predecessorId }),
    onSuccess: () => {
      refresh();
      toast.success('Dependency created');
      setAddOpen(false);
      setPredecessorId('');
      setSuccessorId('');
    },
    onError: (error) => toast.error(extractError(error)),
  });

  const removeMutation = useMutation({
    mutationFn: ({ successor, dependencyId }) =>
      tasksApi.dependencies.remove(activeWorkspaceId, successor, dependencyId),
    onSuccess: () => { refresh(); toast.success('Dependency removed'); },
    onError: (error) => toast.error(extractError(error)),
  });

  const taskTitle = (id) => tasks.find((task) => task._id === id)?.title || nodes.find((node) => node.id === id)?.title || 'Task';

  const flowNodes = useMemo(() => nodes.map((node, index) => ({
    id: node.id,
    position: { x: 40 + (index % 4) * 240, y: 30 + Math.floor(index / 4) * 110 },
    data: {
      label: (
        <div className={`px-2.5 py-2 rounded-lg border text-left w-[190px] ${
          node.isBlocked ? 'bg-red-50 border-red-300' : node.status === 'done' ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-surface-200'
        }`}>
          <p className="text-[11px] font-semibold text-surface-900 truncate">{node.title}</p>
          <p className="text-[10px] text-surface-500 capitalize mt-0.5">
            {node.status?.replace('_', ' ')}{node.isBlocked ? ' · blocked' : ''}
          </p>
        </div>
      ),
    },
    style: { border: 'none', background: 'transparent', padding: 0, width: 190 },
  })), [nodes]);

  const flowEdges = useMemo(() => edges.map((edge) => ({
    id: edge.id,
    source: edge.predecessor,
    target: edge.successor,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
    style: { stroke: '#6366f1', strokeWidth: 1.5 },
  })), [edges]);

  const blockedCount = nodes.filter((node) => node.isBlocked).length;

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message="The dependency graph could not be loaded." onRetry={refetch} />;

  return (
    <div className="page">
      <Link to={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-800 mb-3">
        <ArrowLeft size={13} /> {project?.project?.name || 'Project'}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-[19px] font-semibold text-surface-900 flex items-center gap-2">
            <Network size={18} className="text-primary-600" /> Dependencies
          </h1>
          <p className="text-[13px] text-surface-500 mt-0.5">Finish-to-start links between tasks, with cycle detection.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="hidden md:flex items-center gap-0.5 bg-surface-100 rounded-lg p-0.5 mr-1">
            {VIEWS.map((view) => (
              <button
                key={view.path}
                type="button"
                onClick={() => navigate(`/projects/${projectId}/${view.path}`)}
                className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium ${
                  view.path === 'dependencies' ? 'bg-white text-surface-900 shadow-subtle' : 'text-surface-500 hover:text-surface-800'
                }`}
              >
                <view.icon size={12} /> {view.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary btn-sm" onClick={() => setAddOpen(true)}>
            <Plus size={13} /> Link tasks
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4 max-w-2xl">
        <StatCard label="Tasks" value={nodes.length} icon={GitCommit} tone="primary" />
        <StatCard label="Dependencies" value={edges.length} icon={Link2} />
        <StatCard label="Blocked" value={blockedCount} tone={blockedCount ? 'danger' : 'default'} />
      </div>

      {nodes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={GitCommit}
            title="No tasks in this project"
            description="Add tasks first, then link them to model blockers and ordering."
          />
        </div>
      ) : (
        <div className="card h-[520px] overflow-hidden relative">
          <ReactFlow nodes={flowNodes} edges={flowEdges} fitView nodesDraggable={false} nodesConnectable={false}>
            <Background gap={18} size={1} color="#e2e8f0" />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      )}

      {edges.length > 0 && (
        <div className="card mt-4">
          <header className="px-4 h-11 flex items-center justify-between border-b border-surface-100">
            <h2 className="section-title">Dependency list</h2>
            <span className="text-2xs text-surface-400">{edges.length} links</span>
          </header>
          <div className="divide-y divide-surface-100">
            {edges.map((edge) => (
              <div key={edge.id} className="flex items-center gap-2 px-4 py-2">
                <span className="text-xs text-surface-700 truncate max-w-[38%]">{taskTitle(edge.predecessor)}</span>
                <span className="text-2xs text-surface-400">blocks</span>
                <span className="text-xs text-surface-700 truncate flex-1">{taskTitle(edge.successor)}</span>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate({ successor: edge.successor, dependencyId: edge.id })}
                  className="btn-icon text-surface-400 hover:text-red-600 hover:bg-red-50"
                  aria-label={`Remove dependency between ${taskTitle(edge.predecessor)} and ${taskTitle(edge.successor)}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Link two tasks"
        description="The predecessor must finish before the successor can be completed."
        size="md"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn-primary"
              disabled={!predecessorId || !successorId || predecessorId === successorId || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              Create link
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Predecessor (finishes first)" required id="dep-pred">
            <Select id="dep-pred" value={predecessorId} onChange={(event) => setPredecessorId(event.target.value)}>
              <option value="">Select a task…</option>
              {tasks.map((task) => <option key={task._id} value={task._id}>{task.title}</option>)}
            </Select>
          </FormField>
          <FormField label="Successor (blocked until then)" required id="dep-succ">
            <Select id="dep-succ" value={successorId} onChange={(event) => setSuccessorId(event.target.value)}>
              <option value="">Select a task…</option>
              {tasks.map((task) => <option key={task._id} value={task._id}>{task.title}</option>)}
            </Select>
          </FormField>
          {predecessorId && predecessorId === successorId && (
            <p className="text-xs text-red-600 flex items-center gap-1"><X size={12} /> A task cannot depend on itself.</p>
          )}
          <p className="text-2xs text-surface-400">
            Circular dependencies (A → B → A) are rejected by the server.
          </p>
        </div>
      </Dialog>
    </div>
  );
};

export default DependencyGraphPage;
