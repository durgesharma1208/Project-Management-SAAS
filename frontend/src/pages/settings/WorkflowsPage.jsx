import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitBranch, Plus, Check, Shield, AlertTriangle, Layers,
  ChevronRight, RefreshCw, Trash2, ArrowRight
} from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { workflowsApi, workflowKeys } from '../../lib/taskApi';
import { PageLoader } from '../../components/ui/Spinner';
import { Dialog } from '../../components/ui/Dialog';
import { Alert, extractError } from '../../components/ui/Alert';

const CATEGORY_COLORS = {
  not_started: 'bg-surface-100 text-surface-700',
  active: 'bg-blue-50 text-blue-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
};

export const WorkflowsPage = () => {
  const { activeWorkspaceId } = useWorkspace();
  const qc = useQueryClient();
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Form states for new workflow
  const [newWfName, setNewWfName] = useState('');
  const [newWfDesc, setNewWfDesc] = useState('');

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: workflowKeys.all(activeWorkspaceId),
    queryFn: () => workflowsApi.list(activeWorkspaceId),
    enabled: !!activeWorkspaceId,
  });

  const seedTemplatesMutation = useMutation({
    mutationFn: () => workflowsApi.seedTemplates(activeWorkspaceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workflowKeys.all(activeWorkspaceId) });
    },
    onError: (e) => setApiError(extractError(e)),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => workflowsApi.create(activeWorkspaceId, payload),
    onSuccess: (wf) => {
      qc.invalidateQueries({ queryKey: workflowKeys.all(activeWorkspaceId) });
      setSelectedWorkflow(wf);
      setCreateDialogOpen(false);
      setNewWfName('');
      setNewWfDesc('');
    },
    onError: (e) => setApiError(extractError(e)),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (wfId) => workflowsApi.update(activeWorkspaceId, wfId, { isDefault: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workflowKeys.all(activeWorkspaceId) });
    },
    onError: (e) => setApiError(extractError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (wfId) => workflowsApi.delete(activeWorkspaceId, wfId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workflowKeys.all(activeWorkspaceId) });
      setSelectedWorkflow(null);
    },
    onError: (e) => setApiError(extractError(e)),
  });

  const currentWf = selectedWorkflow || workflows[0];

  const handleCreateDefault = () => {
    createMutation.mutate({
      name: newWfName,
      description: newWfDesc,
      statuses: [
        { id: 'backlog', name: 'Backlog', color: '#94a3b8', category: 'not_started', position: 0 },
        { id: 'todo', name: 'To Do', color: '#3b82f6', category: 'not_started', position: 1 },
        { id: 'in_progress', name: 'In Progress', color: '#f59e0b', category: 'active', position: 2 },
        { id: 'done', name: 'Done', color: '#22c55e', category: 'completed', position: 3 },
      ],
      transitions: [
        { from: 'backlog', to: 'todo' },
        { from: 'todo', to: 'in_progress' },
        { from: 'in_progress', to: 'done' },
        { from: 'in_progress', to: 'todo' },
        { from: 'done', to: 'in_progress' },
      ],
    });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-900 flex items-center gap-2">
            <GitBranch className="text-primary-600" size={24} />
            Task Blueprints & Workflows
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Define custom lifecycle stages and enforce allowed transitions for tasks.
          </p>
        </div>
        <div className="flex gap-2">
          {workflows.length === 0 && (
            <button
              onClick={() => seedTemplatesMutation.mutate()}
              className="btn-secondary btn-sm flex items-center gap-1.5"
            >
              <RefreshCw size={14} /> Seed Default Templates
            </button>
          )}
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="btn-primary btn-sm flex items-center gap-1.5"
          >
            <Plus size={14} /> Create Workflow
          </button>
        </div>
      </div>

      <Alert type="error" message={apiError} dismissible onDismiss={() => setApiError(null)} />

      {workflows.length === 0 ? (
        <div className="card text-center py-16">
          <Layers size={48} className="mx-auto text-surface-300 mb-3" />
          <h3 className="text-base font-semibold text-surface-800">No Custom Workflows Yet</h3>
          <p className="text-sm text-surface-500 max-w-md mx-auto mt-1 mb-5">
            Get started immediately by seeding standard agile templates (Software Development, Bug Resolution, Standard Project).
          </p>
          <button
            onClick={() => seedTemplatesMutation.mutate()}
            className="btn-primary inline-flex items-center gap-2"
          >
            <RefreshCw size={15} /> Load Workflow Templates
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Workflows List */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-400 px-1">
              Available Workflows
            </h3>
            <div className="card divide-y divide-surface-100 overflow-hidden">
              {workflows.map((wf) => {
                const isSelected = currentWf?._id === wf._id;
                return (
                  <button
                    key={wf._id}
                    onClick={() => setSelectedWorkflow(wf)}
                    className={`w-full text-left p-4 transition-colors flex items-center justify-between ${
                      isSelected ? 'bg-primary-50/60' : 'hover:bg-surface-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-surface-900 text-sm">{wf.name}</span>
                        {wf.isDefault && (
                          <span className="badge bg-green-50 text-green-700 border border-green-200 text-[10px]">
                            Default
                          </span>
                        )}
                        {wf.isTemplate && (
                          <span className="badge bg-purple-50 text-purple-700 border border-purple-200 text-[10px]">
                            Template
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-surface-500 mt-1 line-clamp-1">{wf.description || 'No description'}</p>
                      <p className="text-[11px] text-surface-400 mt-2">
                        {wf.statuses?.length || 0} statuses • {wf.transitions?.length || 0} transition rules
                      </p>
                    </div>
                    <ChevronRight size={16} className={isSelected ? 'text-primary-600' : 'text-surface-300'} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Workflow Details & Transitions Editor Preview */}
          <div className="md:col-span-2 space-y-4">
            {currentWf ? (
              <div className="card p-6 space-y-6">
                <div className="flex items-start justify-between pb-4 border-b border-surface-100">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-surface-900">{currentWf.name}</h2>
                      {currentWf.isDefault ? (
                        <span className="badge bg-green-100 text-green-800 text-xs font-medium">Default Workflow</span>
                      ) : (
                        <button
                          onClick={() => setDefaultMutation.mutate(currentWf._id)}
                          className="btn-secondary btn-sm text-xs"
                        >
                          Make Default
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-surface-500 mt-1">{currentWf.description}</p>
                  </div>
                  {!currentWf.isDefault && (
                    <button
                      onClick={() => deleteMutation.mutate(currentWf._id)}
                      className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                      title="Delete workflow"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Statuses */}
                <div>
                  <h3 className="text-sm font-semibold text-surface-800 mb-3">Configured Statuses ({currentWf.statuses?.length})</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {currentWf.statuses?.map((st) => (
                      <div key={st.id} className="p-3 border border-surface-200 rounded-xl bg-surface-50/50 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: st.color }} />
                          <span className="text-sm font-semibold text-surface-800">{st.name}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-surface-400">
                          <code>{st.id}</code>
                          <span className={`px-1.5 py-0.5 rounded capitalize ${CATEGORY_COLORS[st.category] || 'bg-surface-100'}`}>
                            {st.category?.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Transitions Matrix */}
                <div>
                  <h3 className="text-sm font-semibold text-surface-800 mb-3">
                    Allowed State Transitions ({currentWf.transitions?.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentWf.transitions?.map((tr, idx) => {
                      const fromStatus = currentWf.statuses?.find((s) => s.id === tr.from);
                      const toStatus = currentWf.statuses?.find((s) => s.id === tr.to);
                      return (
                        <div key={idx} className="flex items-center gap-2 p-2.5 border border-surface-200 rounded-lg bg-white text-xs">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: fromStatus?.color || '#94a3b8' }} />
                          <span className="font-medium text-surface-800">{fromStatus?.name || tr.from}</span>
                          <ArrowRight size={13} className="text-surface-400 mx-auto" />
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: toStatus?.color || '#94a3b8' }} />
                          <span className="font-medium text-surface-800">{toStatus?.name || tr.to}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card p-12 text-center text-surface-400 text-sm">Select a workflow to view details</div>
            )}
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        title="Create Custom Workflow"
        footer={
          <>
            <button className="btn-secondary btn-sm" onClick={() => setCreateDialogOpen(false)}>Cancel</button>
            <button
              className="btn-primary btn-sm"
              disabled={!newWfName.trim()}
              onClick={handleCreateDefault}
            >
              Create
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Workflow Name</label>
            <input
              type="text"
              value={newWfName}
              onChange={(e) => setNewWfName(e.target.value)}
              placeholder="e.g. Design Lifecycle"
              className="input"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              value={newWfDesc}
              onChange={(e) => setNewWfDesc(e.target.value)}
              placeholder="Purpose of this workflow..."
              className="input h-20 resize-none"
            />
          </div>
          <p className="text-xs text-surface-500">
            Initial standard states (Backlog → To Do → In Progress → Done) and transitions will be populated automatically and can be customized.
          </p>
        </div>
      </Dialog>
    </div>
  );
};
