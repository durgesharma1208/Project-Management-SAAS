import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, FolderOpen, Archive, Edit2, MoreHorizontal, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../lib/api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { PageLoader } from '../../components/ui/Spinner';
import { PriorityBadge, ProjectStatusBadge } from '../../components/ui/Badge';
import { Avatar, AvatarGroup } from '../../components/ui/Avatar';
import { Dialog } from '../../components/ui/Dialog';
import { FormField, Input, Textarea, Select } from '../../components/ui/Form';
import { Alert, extractError } from '../../components/ui/Alert';
import { useForm } from 'react-hook-form';

const EMOJIS = ['📋', '🚀', '💡', '🎯', '🛠️', '📊', '🌟', '⚡', '🔮', '🎨'];
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'];

const CreateProjectDialog = ({ isOpen, onClose }) => {
  const { activeWorkspaceId } = useWorkspace();
  const qc = useQueryClient();
  const [apiError, setApiError] = useState(null);
  const [selectedEmoji, setSelectedEmoji] = useState('📋');
  const [selectedColor, setSelectedColor] = useState('#6366f1');

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { status: 'planned', priority: 'medium' }
  });

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/workspaces/${activeWorkspaceId}/projects`, data).then(r => r.data.data.project),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects', activeWorkspaceId] });
      reset();
      onClose();
    },
    onError: (e) => setApiError(extractError(e)),
  });

  const onSubmit = (data) => {
    setApiError(null);
    mutation.mutate({ ...data, emoji: selectedEmoji, color: selectedColor });
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Create Project" size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit(onSubmit)} disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create Project'}
          </button>
        </>
      }>
      <div className="space-y-4">
        <Alert type="error" message={apiError} />

        {/* Emoji + Color picker */}
        <div className="flex items-center gap-4">
          <div>
            <p className="label">Icon</p>
            <div className="flex gap-1.5 flex-wrap">
              {EMOJIS.map(e => (
                <button key={e} type="button"
                  onClick={() => setSelectedEmoji(e)}
                  className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${selectedEmoji === e ? 'bg-primary-100 ring-2 ring-primary-500' : 'hover:bg-surface-100'}`}
                >{e}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Color</p>
            <div className="flex gap-1.5">
              {COLORS.map(c => (
                <button key={c} type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`w-6 h-6 rounded-full transition-all ${selectedColor === c ? 'ring-2 ring-offset-2 ring-surface-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <FormField label="Project name" error={errors.name?.message} required id="proj-name">
          <Input id="proj-name" {...register('name', { required: 'Name is required' })} placeholder="My awesome project" error={errors.name} />
        </FormField>

        <FormField label="Description" id="proj-desc">
          <Textarea id="proj-desc" {...register('description')} placeholder="What is this project about?" rows={3} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Status" id="proj-status">
            <Select id="proj-status" {...register('status')}>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </Select>
          </FormField>
          <FormField label="Priority" id="proj-priority">
            <Select id="proj-priority" {...register('priority')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Start date" id="proj-start">
            <Input id="proj-start" type="date" {...register('startDate')} />
          </FormField>
          <FormField label="Due date" id="proj-due">
            <Input id="proj-due" type="date" {...register('dueDate')} />
          </FormField>
        </div>
      </div>
    </Dialog>
  );
};

const ProjectCard = ({ project, onClick }) => {
  const total = project.totalTasks || 0;
  const done = project.completedTasks || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div
      className="card p-5 cursor-pointer hover:shadow-elevated hover:border-primary-200 transition-all group"
      onClick={() => onClick(project._id)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{project.emoji || '📋'}</span>
          <div>
            <h3 className="font-semibold text-surface-900 group-hover:text-primary-700 transition-colors leading-tight">
              {project.name}
            </h3>
            {project.owner && (
              <p className="text-xs text-surface-400 mt-0.5">by {project.owner.name}</p>
            )}
          </div>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      {project.description && (
        <p className="text-xs text-surface-500 truncate-2 mb-3">{project.description}</p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-surface-500">
          <span>{done}/{total} tasks</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full bg-surface-100 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: project.color || '#6366f1' }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <AvatarGroup users={project.members || []} max={3} size="xs" />
        <div className="flex items-center gap-2">
          <PriorityBadge priority={project.priority} showLabel={false} />
          {project.dueDate && (
            <span className="text-[10px] text-surface-400">{format(new Date(project.dueDate), 'MMM d')}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export const ProjectsPage = () => {
  const { activeWorkspaceId } = useWorkspace();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(searchParams.get('new') === '1');

  const { data, isLoading } = useQuery({
    queryKey: ['projects', activeWorkspaceId, search, statusFilter],
    queryFn: () => api.get(`/workspaces/${activeWorkspaceId}/projects`, {
      params: { search: search || undefined, status: statusFilter || undefined }
    }).then(r => r.data.data),
    enabled: !!activeWorkspaceId,
  });

  const projects = data?.projects || [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-surface-900">Projects</h1>
          <p className="text-sm text-surface-500 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-surface-200 rounded-lg px-3 py-2 w-64">
          <Search size={14} className="text-surface-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="bg-transparent outline-none text-sm text-surface-700 placeholder:text-surface-400 w-full"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="">All statuses</option>
          <option value="planned">Planned</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen size={48} className="text-surface-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-surface-700 mb-2">
            {search || statusFilter ? 'No projects match your filters' : 'No projects yet'}
          </h2>
          <p className="text-sm text-surface-400 mb-6">
            {search || statusFilter ? 'Try adjusting your search or filter' : 'Create your first project to get started'}
          </p>
          {!search && !statusFilter && (
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> Create project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <ProjectCard key={p._id} project={p} onClick={(id) => navigate(`/projects/${id}`)} />
          ))}
        </div>
      )}

      <CreateProjectDialog isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};
