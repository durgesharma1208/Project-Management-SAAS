import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, Check, GitBranch, Layers, Plus, RefreshCw, ShieldCheck, Trash2,
} from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../components/ui/Toast';
import { EmptyState, ErrorState, PageHeader, PageSkeleton } from '../../components/ui/Primitives';
import { Dialog } from '../../components/ui/Dialog';
import { FormField, Input, Select, Textarea } from '../../components/ui/Form';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Spinner } from '../../components/ui/Spinner';
import { workflowsApi, workflowKeys } from '../../lib/taskApi';
import { extractError } from '../../components/ui/Alert';

const STARTER_WORKFLOWS = {
  standard: {
    label: 'Standard project (4 stages)',
    statuses: [
      { id: 'backlog', name: 'Backlog', color: '#94a3b8', category: 'not_started', position: 0 },
      { id: 'todo', name: 'To Do', color: '#3b82f6', category: 'not_started', position: 1 },
      { id: 'in_progress', name: 'In Progress', color: '#f59e0b', category: 'active', position: 2 },
      { id: 'done', name: 'Done', color: '#10b981', category: 'completed', position: 3 },
    ],
    transitions: [
      { from: 'backlog', to: 'todo' },
      { from: 'todo', to: 'in_progress' },
      { from: 'in_progress', to: 'done' },
      { from: 'in_progress', to: 'todo' },
      { from: 'todo', to: 'backlog' },
      { from: 'done', to: 'in_progress' },
    ],
  },
  development: {
    label: 'Software development (5 stages)',
    statuses: [
      { id: 'backlog', name: 'Backlog', color: '#94a3b8', category: 'not_started', position: 0 },
      { id: 'todo', name: 'To Do', color: '#3b82f6', category: 'not_started', position: 1 },
      { id: 'in_progress', name: 'In Progress', color: '#f59e0b', category: 'active', position: 2 },
      { id: 'in_review', name: 'In Review', color: '#8b5cf6', category: 'active', position: 3 },
      { id: 'done', name: 'Done', color: '#10b981', category: 'completed', position: 4 },
    ],
    transitions: [
      { from: 'backlog', to: 'todo' },
      { from: 'todo', to: 'in_progress' },
      { from: 'in_progress', to: 'in_review' },
      { from: 'in_review', to: 'done' },
      { from: 'in_review', to: 'in_progress' },
      { from: 'in_progress', to: 'todo' },
      { from: 'done', to: 'in_review' },
    ],
  },
};

const CreateWorkflowDialog = ({ isOpen, onClose }) => {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [starter, setStarter] = useState('standard');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) { setName(''); setDescription(''); setStarter('standard'); setError(''); }
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: () => {
      const preset = STARTER_WORKFLOWS[starter];
      return workflowsApi.create(activeWorkspaceId, {
        name: name.trim(),
        description: description.trim(),
        statuses: preset.statuses,
        transitions: preset.transitions,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.all(activeWorkspaceId) });
      toast.success('Workflow created');
      onClose();
    },
    onError: (apiError) => setError(extractError(apiError)),
  });

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create workflow"
      description="Workflows define the statuses tasks can move through."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => { if (!name.trim()) { setError('A workflow name is required'); return; } setError(''); mutation.mutate(); }}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Spinner size={14} />} Create workflow
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="Workflow name" required id="wf-name" error={error}>
          <Input id="wf-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Design lifecycle" autoFocus />
        </FormField>
        <FormField label="Description" id="wf-desc">
          <Textarea id="wf-desc" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is this workflow for?" />
        </FormField>
        <FormField label="Starting statuses" id="wf-starter">
          <Select id="wf-starter" value={starter} onChange={(event) => setStarter(event.target.value)}>
            {Object.entries(STARTER_WORKFLOWS).map(([key, preset]) => (
              <option key={key} value={key}>{preset.label}</option>
            ))}
          </Select>
        </FormField>
        <p className="text-2xs text-surface-400">
          You can adjust transitions and mark this workflow as the workspace default afterwards.
        </p>
      </div>
    </Dialog>
  );
};

export const WorkflowsPage = () => {
  const { activeWorkspaceId, canManageWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: workflows = [], isLoading, isError, refetch } = useQuery({
    queryKey: workflowKeys.all(activeWorkspaceId),
    queryFn: () => workflowsApi.list(activeWorkspaceId),
    enabled: Boolean(activeWorkspaceId),
  });

  const active = useMemo(
    () => workflows.find((workflow) => workflow._id === selectedId) || workflows[0],
    [workflows, selectedId],
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: workflowKeys.all(activeWorkspaceId) });

  const seedMutation = useMutation({
    mutationFn: () => workflowsApi.seedTemplates(activeWorkspaceId),
    onSuccess: () => { refresh(); toast.success('Workflow templates loaded'); },
    onError: (error) => toast.error(extractError(error)),
  });

  const defaultMutation = useMutation({
    mutationFn: (workflow) => workflowsApi.update(activeWorkspaceId, workflow._id, { isDefault: true }),
    onSuccess: () => { refresh(); toast.success('Default workflow updated'); },
    onError: (error) => toast.error(extractError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (workflow) => workflowsApi.remove(activeWorkspaceId, workflow._id),
    onSuccess: () => { refresh(); setConfirmDelete(false); setSelectedId(null); toast.success('Workflow deleted'); },
    onError: (error) => toast.error(extractError(error)),
  });

  return (
    <div className="page">
      <PageHeader
        title="Workflows"
        description="Define the lifecycle statuses and allowed transitions for your projects."
        actions={
          <>
            {workflows.length === 0 && canManageWorkspace && (
              <button type="button" className="btn-secondary" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                <RefreshCw size={14} /> Load templates
              </button>
            )}
            {canManageWorkspace && (
              <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
                <Plus size={14} /> New workflow
              </button>
            )}
          </>
        }
      />

      {!canManageWorkspace && (
        <p className="mb-3 text-xs text-surface-500 flex items-center gap-1.5">
          <ShieldCheck size={13} /> Only workspace admins can create or change workflows.
        </p>
      )}

      {isLoading ? (
        <PageSkeleton cards={2} />
      ) : isError ? (
        <ErrorState message="Workflows could not be loaded." onRetry={refetch} />
      ) : workflows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Layers}
            title="No workflows yet"
            description="Load the built-in templates or create your own status set. Projects without a workflow allow any status change."
            action={canManageWorkspace ? (
              <button type="button" className="btn-primary" onClick={() => seedMutation.mutate()}>
                <RefreshCw size={14} /> Load workflow templates
              </button>
            ) : null}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            {workflows.map((workflow) => {
              const isActive = active?._id === workflow._id;
              return (
                <button
                  key={workflow._id}
                  type="button"
                  onClick={() => setSelectedId(workflow._id)}
                  className={`w-full text-left card p-3 transition-colors ${
                    isActive ? 'border-primary-300 bg-primary-50/40' : 'hover:border-surface-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <GitBranch size={14} className={isActive ? 'text-primary-600' : 'text-surface-400'} />
                    <span className="text-[13px] font-medium text-surface-900 truncate">{workflow.name}</span>
                    {workflow.isDefault && <span className="badge bg-emerald-50 text-emerald-700">Default</span>}
                    {workflow.isTemplate && <span className="badge bg-violet-50 text-violet-700">Template</span>}
                  </div>
                  <p className="text-2xs text-surface-500 mt-1 line-clamp-2">{workflow.description || 'No description'}</p>
                  <p className="text-2xs text-surface-400 mt-1.5">
                    {workflow.statuses?.length || 0} statuses · {workflow.transitions?.length || 0} transitions
                  </p>
                </button>
              );
            })}
          </div>

          {active && (
            <div className="lg:col-span-2 space-y-4">
              <section className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-[15px] font-semibold text-surface-900 flex items-center gap-2">
                      {active.name}
                      {active.isDefault && <span className="badge bg-emerald-50 text-emerald-700"><Check size={11} /> Workspace default</span>}
                    </h2>
                    <p className="text-xs text-surface-500 mt-0.5">{active.description || 'No description'}</p>
                  </div>
                  {canManageWorkspace && (
                    <div className="flex items-center gap-1.5">
                      {!active.isDefault && (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => defaultMutation.mutate(active)}
                          disabled={defaultMutation.isPending}
                        >
                          Make default
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                        onClick={() => setConfirmDelete(true)}
                        disabled={active.isDefault}
                        title={active.isDefault ? 'Set another workflow as default first' : 'Delete workflow'}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="text-xs font-semibold text-surface-700 mb-2">Statuses</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(active.statuses || []).map((status) => (
                    <div key={status.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-surface-200">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-surface-800 truncate">{status.name}</p>
                        <p className="text-2xs text-surface-400 capitalize">{status.category.replace('_', ' ')}</p>
                      </div>
                      <code className="ml-auto text-2xs text-surface-400">{status.id}</code>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card p-4">
                <h3 className="text-xs font-semibold text-surface-700 mb-2">Allowed transitions</h3>
                {(active.transitions || []).length === 0 ? (
                  <p className="text-xs text-surface-400">No transitions configured — tasks can move between any statuses.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {active.transitions.map((transition, index) => {
                      const from = active.statuses?.find((status) => status.id === transition.from);
                      const to = active.statuses?.find((status) => status.id === transition.to);
                      return (
                        <div key={`${transition.from}-${transition.to}-${index}`} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-50 border border-surface-200 text-xs">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: from?.color || '#94a3b8' }} />
                          <span className="text-surface-700 truncate">{from?.name || transition.from}</span>
                          <ArrowRight size={11} className="text-surface-400 flex-shrink-0" />
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: to?.color || '#94a3b8' }} />
                          <span className="text-surface-700 truncate">{to?.name || transition.to}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      <CreateWorkflowDialog isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate(active)}
        title="Delete workflow"
        message={`“${active?.name}” will be removed. Projects using it fall back to the workspace default workflow.`}
        confirmLabel="Delete workflow"
        danger
        isPending={deleteMutation.isPending}
      />
    </div>
  );
};

export default WorkflowsPage;
