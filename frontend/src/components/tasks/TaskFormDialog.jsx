import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { FormField, Input, Select, Textarea } from '../ui/Form';
import { Alert, extractError } from '../ui/Alert';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../ui/Toast';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useMembers } from '../../hooks/useMembers';
import {
  projectsApi, tasksApi, workflowsApi, projectKeys, taskKeys, dashboardKeys, workflowKeys,
} from '../../lib/taskApi';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../lib/constants';
import { toInputDate } from '../../lib/format';

const buildDefaults = (task, defaults) => ({
  title: task?.title || defaults.title || '',
  description: task?.description || defaults.description || '',
  project: task?.project?._id || task?.project || defaults.projectId || '',
  status: task?.status || defaults.status || 'backlog',
  priority: task?.priority || defaults.priority || 'medium',
  assignee: task?.assignee?._id || task?.assignee || defaults.assignee || '',
  startDate: toInputDate(task?.startDate) || toInputDate(defaults.startDate),
  dueDate: toInputDate(task?.dueDate) || toInputDate(defaults.dueDate),
  estimatedHours: task?.estimatedHours ?? '',
  labels: (task?.labels || []).join(', '),
});

/**
 * Create / edit task dialog. Used from the board, list, project and global
 * "New" menu so the fields and validation stay identical everywhere.
 */
export const TaskFormDialog = ({ isOpen, onClose, task = null, defaults = {}, onSaved }) => {
  const { activeWorkspaceId } = useWorkspace();
  const { users } = useMembers();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [apiError, setApiError] = useState(null);
  const isEdit = Boolean(task?._id);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: buildDefaults(task, defaults),
  });

  useEffect(() => {
    if (isOpen) {
      setApiError(null);
      reset(buildDefaults(task, defaults));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task?._id]);

  const selectedProjectId = watch('project');

  const { data: projects = [] } = useQuery({
    queryKey: projectKeys.list(activeWorkspaceId, { scope: 'form' }),
    queryFn: () => projectsApi.list(activeWorkspaceId, { limit: 200 }),
    enabled: Boolean(activeWorkspaceId) && isOpen,
  });

  const { data: projectWorkflow } = useQuery({
    queryKey: workflowKeys.project(activeWorkspaceId, selectedProjectId),
    queryFn: () => workflowsApi.projectWorkflow(activeWorkspaceId, selectedProjectId),
    enabled: Boolean(activeWorkspaceId && selectedProjectId) && isOpen,
  });

  const statusOptions = useMemo(() => {
    const statuses = projectWorkflow?.workflow?.statuses;
    if (statuses?.length) {
      return [...statuses]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((s) => ({ value: s.id, label: s.name }));
    }
    return TASK_STATUSES.map((s) => ({ value: s.id, label: s.label }));
  }, [projectWorkflow]);

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit
      ? tasksApi.update(activeWorkspaceId, task._id, payload)
      : tasksApi.create(activeWorkspaceId, payload)),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all(activeWorkspaceId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.all(activeWorkspaceId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.workspace(activeWorkspaceId) });
      toast.success(isEdit ? 'Task updated' : `Task created in ${saved?.project?.name || 'project'}`);
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => setApiError(extractError(error)),
  });

  const onSubmit = (values) => {
    setApiError(null);
    const payload = {
      title: values.title.trim(),
      description: values.description?.trim() || '',
      project: values.project,
      status: values.status,
      priority: values.priority,
      assignee: values.assignee || null,
      startDate: values.startDate || null,
      dueDate: values.dueDate || null,
      estimatedHours: values.estimatedHours === '' ? null : Number(values.estimatedHours),
      labels: values.labels
        ? values.labels.split(',').map((l) => l.trim()).filter(Boolean)
        : [],
    };
    mutation.mutate(payload);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit task' : 'New task'}
      description={isEdit ? 'Update the details and save your changes.' : 'Add a task to one of your projects.'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSubmit(onSubmit)} disabled={mutation.isPending}>
            {mutation.isPending && <Spinner size={14} />}
            {isEdit ? 'Save changes' : 'Create task'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Alert type="error" message={apiError} />

        <FormField label="Title" error={errors.title?.message} required id="task-title">
          <Input
            id="task-title"
            {...register('title', {
              required: 'A task title is required',
              maxLength: { value: 500, message: 'Title is too long' },
            })}
            placeholder="e.g. Design the onboarding flow"
            error={errors.title}
          />
        </FormField>

        <FormField label="Description" id="task-desc">
          <Textarea
            id="task-desc"
            rows={3}
            {...register('description', { maxLength: { value: 10000, message: 'Description is too long' } })}
            placeholder="Add context, acceptance criteria or links…"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Project" error={errors.project?.message} required id="task-project">
            <Select
              id="task-project"
              {...register('project', { required: 'Choose a project' })}
              disabled={isEdit && defaults.lockProject}
              error={errors.project}
            >
              <option value="">Select a project…</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.emoji ? `${project.emoji} ` : ''}{project.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Assignee" id="task-assignee">
            <Select id="task-assignee" {...register('assignee')}>
              <option value="">Unassigned</option>
              {users.map((member) => (
                <option key={member._id} value={member._id}>{member.name}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Status" id="task-status">
            <Select id="task-status" {...register('status')}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Priority" id="task-priority">
            <Select id="task-priority" {...register('priority')}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Start date" id="task-start">
            <Input id="task-start" type="date" {...register('startDate')} />
          </FormField>

          <FormField
            label="Due date"
            id="task-due"
            error={errors.dueDate?.message}
            hint="Due dates drive the dashboard, calendar and Gantt views."
          >
            <Input
              id="task-due"
              type="date"
              {...register('dueDate', {
                validate: (value, formValues) =>
                  !value || !formValues.startDate || value >= formValues.startDate
                  || 'Due date cannot be before the start date',
              })}
              error={errors.dueDate}
            />
          </FormField>

          <FormField label="Estimate (hours)" id="task-estimate">
            <Input
              id="task-estimate"
              type="number"
              min="0"
              step="0.5"
              {...register('estimatedHours', { min: { value: 0, message: 'Must be positive' } })}
              placeholder="e.g. 4"
            />
          </FormField>

          <FormField label="Labels" id="task-labels" hint="Comma separated, e.g. design, frontend">
            <Input id="task-labels" {...register('labels')} placeholder="design, frontend" />
          </FormField>
        </div>

        {isEdit && (
          <p className="flex items-center gap-1.5 text-2xs text-surface-400">
            <Trash2 size={11} /> Use the task panel to delete this task or manage subtasks.
          </p>
        )}
        {/* Keeps Enter-to-submit working without a visible submit button */}
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      </form>
    </Dialog>
  );
};

export default TaskFormDialog;
