import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { FormField, Input, Select, Textarea } from '../ui/Form';
import { Alert, extractError } from '../ui/Alert';
import { Spinner } from '../ui/Spinner';
import { Avatar } from '../ui/Avatar';
import { useToast } from '../ui/Toast';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useMembers } from '../../hooks/useMembers';
import { projectsApi, projectKeys, dashboardKeys } from '../../lib/taskApi';
import { PROJECT_COLORS, PROJECT_EMOJIS, PROJECT_STATUSES } from '../../lib/constants';
import { toInputDate } from '../../lib/format';

const defaultsFor = (project) => ({
  name: project?.name || '',
  description: project?.description || '',
  status: project?.status || 'planned',
  priority: project?.priority || 'medium',
  startDate: toInputDate(project?.startDate),
  dueDate: toInputDate(project?.dueDate),
});

/** Create / edit project dialog, reused by the projects list and project page. */
export const ProjectFormDialog = ({ isOpen, onClose, project = null, onSaved }) => {
  const { activeWorkspaceId } = useWorkspace();
  const { users } = useMembers();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [apiError, setApiError] = useState(null);
  const [emoji, setEmoji] = useState(project?.emoji || '📋');
  const [color, setColor] = useState(project?.color || PROJECT_COLORS[0]);
  const [memberIds, setMemberIds] = useState([]);
  const isEdit = Boolean(project?._id);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: defaultsFor(project),
  });

  useEffect(() => {
    if (!isOpen) return;
    reset(defaultsFor(project));
    setEmoji(project?.emoji || '📋');
    setColor(project?.color || PROJECT_COLORS[0]);
    setMemberIds((project?.members || []).map((m) => m._id || m));
    setApiError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, project?._id]);

  const mutation = useMutation({
    mutationFn: (payload) => (isEdit
      ? projectsApi.update(activeWorkspaceId, project._id, payload)
      : projectsApi.create(activeWorkspaceId, payload)),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all(activeWorkspaceId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.workspace(activeWorkspaceId) });
      if (isEdit) queryClient.invalidateQueries({ queryKey: projectKeys.detail(activeWorkspaceId, project._id) });
      toast.success(isEdit ? 'Project updated' : `Project "${saved.name}" created`);
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => setApiError(extractError(error)),
  });

  const toggleMember = (id) => {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const onSubmit = (values) => {
    setApiError(null);
    mutation.mutate({
      name: values.name.trim(),
      description: values.description?.trim() || '',
      status: values.status,
      priority: values.priority,
      startDate: values.startDate || null,
      dueDate: values.dueDate || null,
      emoji,
      color,
      members: memberIds,
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit project' : 'New project'}
      description={isEdit ? 'Update project details, dates and members.' : 'Projects group tasks, boards and timelines.'}
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSubmit(onSubmit)} disabled={mutation.isPending}>
            {mutation.isPending && <Spinner size={14} />}
            {isEdit ? 'Save changes' : 'Create project'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Alert type="error" message={apiError} />

        <div className="flex flex-wrap items-start gap-4">
          <div>
            <p className="label">Icon</p>
            <div className="flex flex-wrap gap-1 max-w-[220px]">
              {PROJECT_EMOJIS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setEmoji(option)}
                  aria-label={`Use ${option} as project icon`}
                  aria-pressed={emoji === option}
                  className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition ${
                    emoji === option ? 'bg-primary-50 ring-1 ring-primary-400' : 'hover:bg-surface-100'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Colour</p>
            <div className="flex flex-wrap gap-1.5 max-w-[200px]">
              {PROJECT_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setColor(option)}
                  aria-label={`Use colour ${option}`}
                  aria-pressed={color === option}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition ${
                    color === option ? 'ring-2 ring-offset-2 ring-surface-400' : ''
                  }`}
                  style={{ backgroundColor: option }}
                >
                  {color === option && <Check size={12} className="text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <FormField label="Project name" error={errors.name?.message} required id="project-name">
          <Input
            id="project-name"
            {...register('name', {
              required: 'A project name is required',
              maxLength: { value: 200, message: 'Name is too long' },
            })}
            placeholder="Website redesign"
            error={errors.name}
          />
        </FormField>

        <FormField label="Description" id="project-description">
          <Textarea
            id="project-description"
            rows={2}
            {...register('description', { maxLength: { value: 2000, message: 'Description is too long' } })}
            placeholder="What is this project about?"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Status" id="project-status">
            <Select id="project-status" {...register('status')}>
              {PROJECT_STATUSES.filter((s) => s.id !== 'archived').map((status) => (
                <option key={status.id} value={status.id}>{status.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Priority" id="project-priority">
            <Select id="project-priority" {...register('priority')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </FormField>
          <FormField label="Start date" id="project-start">
            <Input id="project-start" type="date" {...register('startDate')} />
          </FormField>
          <FormField
            label="Due date"
            id="project-due"
            error={errors.dueDate?.message}
            hint="Shown on project cards and the overview."
          >
            <Input
              id="project-due"
              type="date"
              {...register('dueDate', {
                validate: (value, values) =>
                  !value || !values.startDate || value >= values.startDate
                  || 'Due date cannot be before the start date',
              })}
              error={errors.dueDate}
            />
          </FormField>
        </div>

        <div>
          <p className="label">Members</p>
          {users.length === 0 ? (
            <p className="hint">No workspace members loaded yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {users.map((member) => {
                const selected = memberIds.includes(member._id);
                return (
                  <button
                    key={member._id}
                    type="button"
                    onClick={() => toggleMember(member._id)}
                    aria-pressed={selected}
                    className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-xs transition ${
                      selected
                        ? 'border-primary-300 bg-primary-50 text-primary-800'
                        : 'border-surface-200 text-surface-600 hover:bg-surface-50'
                    }`}
                  >
                    <Avatar user={member} size="xs" />
                    {member.name}
                    {selected && <Check size={11} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      </form>
    </Dialog>
  );
};

export default ProjectFormDialog;
