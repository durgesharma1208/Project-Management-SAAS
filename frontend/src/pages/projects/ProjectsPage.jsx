import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive, ArchiveRestore, CalendarDays, FolderKanban, MoreHorizontal,
  Pencil, Plus, Search, Trash2, Users,
} from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../components/ui/Toast';
import { PageHeader, PageSkeleton, EmptyState, ErrorState, ProgressBar } from '../../components/ui/Primitives';
import { PriorityBadge, ProjectStatusBadge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Popover, MenuItem } from '../../components/ui/Menu';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ProjectFormDialog } from '../../components/projects/ProjectFormDialog';
import { projectsApi, projectKeys, dashboardKeys } from '../../lib/taskApi';
import { formatDate, isOverdue } from '../../lib/format';
import { extractError } from '../../components/ui/Alert';

const ProjectCard = ({ project, onOpen, onEdit, onArchive, onRestore, onDelete }) => {
  const overdue = project.dueDate && project.status !== 'completed' && isOverdue(project.dueDate, 'todo');

  return (
    <article className="card group flex flex-col hover:shadow-elevated hover:border-surface-300 transition-all">
      <div className="p-4 flex-1">
        <div className="flex items-start gap-3">
          <span
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
            style={{ backgroundColor: `${project.color || '#6366f1'}1a` }}
          >
            {project.emoji || '📋'}
          </span>
          <div className="flex-1 min-w-0">
            <button type="button" onClick={() => onOpen(project._id)} className="text-left w-full">
              <h3 className="text-[14px] font-semibold text-surface-900 truncate group-hover:text-primary-700 transition-colors">
                {project.name}
              </h3>
            </button>
            <div className="flex items-center gap-1.5 mt-1">
              <ProjectStatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
            </div>
          </div>
          <Popover
            width="w-[184px]"
            trigger={({ toggle }) => (
              <button type="button" className="btn-icon opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={toggle} aria-label={`Actions for ${project.name}`}>
                <MoreHorizontal size={16} />
              </button>
            )}
          >
            {({ close }) => (
              <>
                <MenuItem icon={Pencil} onClick={() => { close(); onEdit(project); }}>Edit project</MenuItem>
                {project.isArchived ? (
                  <MenuItem icon={ArchiveRestore} onClick={() => { close(); onRestore(project); }}>Restore project</MenuItem>
                ) : (
                  <MenuItem icon={Archive} onClick={() => { close(); onArchive(project); }}>Archive project</MenuItem>
                )}
                <div className="my-1 border-t border-surface-100" />
                <MenuItem icon={Trash2} danger onClick={() => { close(); onDelete(project); }}>Delete project</MenuItem>
              </>
            )}
          </Popover>
        </div>

        <p className="text-xs text-surface-500 mt-2.5 line-clamp-2 min-h-[32px]">
          {project.description || 'No description yet.'}
        </p>

        <div className="mt-3">
          <div className="flex items-center justify-between text-2xs text-surface-500 mb-1.5">
            <span>{project.completedTasks || 0} of {project.totalTasks || 0} tasks complete</span>
            <span className="font-medium text-surface-700 tabular-nums">{project.progress ?? 0}%</span>
          </div>
          <ProgressBar value={project.progress ?? 0} color={project.color || '#6366f1'} label={`${project.name} progress`} />
        </div>
      </div>

      <footer className="flex items-center justify-between px-4 py-2.5 border-t border-surface-100">
        <div className="flex items-center -space-x-1.5">
          {(project.members || []).slice(0, 4).map((member) => (
            <Avatar key={member._id} user={member} size="xs" className="ring-2 ring-white" />
          ))}
          {(project.members || []).length === 0 && (
            <span className="flex items-center gap-1 text-2xs text-surface-400"><Users size={11} /> No members</span>
          )}
        </div>
        <span className={`flex items-center gap-1 text-2xs ${overdue ? 'text-red-600 font-medium' : 'text-surface-400'}`}>
          <CalendarDays size={11} />
          {project.dueDate ? formatDate(project.dueDate, 'MMM d') : 'No due date'}
        </span>
      </footer>
    </article>
  );
};

export const ProjectsPage = () => {
  const { activeWorkspaceId } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(searchParams.get('new') === '1');
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState({ type: null, project: null });

  const { data: projects = [], isLoading, isError, refetch } = useQuery({
    queryKey: projectKeys.list(activeWorkspaceId, { search, status, showArchived }),
    queryFn: () => projectsApi.list(activeWorkspaceId, {
      search: search || undefined,
      status: status || undefined,
      archived: showArchived ? 'true' : undefined,
      limit: 100,
    }),
    enabled: Boolean(activeWorkspaceId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: projectKeys.all(activeWorkspaceId) });
    queryClient.invalidateQueries({ queryKey: dashboardKeys.workspace(activeWorkspaceId) });
  };

  const archiveMutation = useMutation({
    mutationFn: (project) => projectsApi.archive(activeWorkspaceId, project._id),
    onSuccess: () => { refresh(); toast.success('Project archived'); setConfirm({ type: null, project: null }); },
    onError: (error) => toast.error(extractError(error)),
  });

  const restoreMutation = useMutation({
    mutationFn: (project) => projectsApi.restore(activeWorkspaceId, project._id),
    onSuccess: () => { refresh(); toast.success('Project restored'); setConfirm({ type: null, project: null }); },
    onError: (error) => toast.error(extractError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (project) => projectsApi.remove(activeWorkspaceId, project._id),
    onSuccess: () => { refresh(); toast.success('Project deleted'); setConfirm({ type: null, project: null }); },
    onError: (error) => toast.error(extractError(error)),
  });

  const filteredCount = useMemo(() => projects.length, [projects]);

  return (
    <div className="page">
      <PageHeader
        title="Projects"
        description={`${filteredCount} ${filteredCount === 1 ? 'project' : 'projects'} ${showArchived ? 'archived' : 'in this workspace'}`}
        actions={
          <button type="button" className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus size={14} /> New project
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search projects…"
            className="input pl-8"
            aria-label="Search projects"
          />
        </div>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="input w-auto"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="planned">Planned</option>
          <option value="active">Active</option>
          <option value="on_hold">On hold</option>
          <option value="completed">Completed</option>
        </select>

        <button
          type="button"
          onClick={() => setShowArchived((value) => !value)}
          aria-pressed={showArchived}
          className={showArchived ? 'btn-secondary' : 'btn-ghost'}
        >
          <Archive size={14} /> {showArchived ? 'Viewing archive' : 'Archived'}
        </button>
      </div>

      {isLoading ? (
        <PageSkeleton cards={2} />
      ) : isError ? (
        <ErrorState message="Projects could not be loaded." onRetry={refetch} />
      ) : projects.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FolderKanban}
            title={search || status ? 'No matching projects' : showArchived ? 'No archived projects' : 'No projects yet'}
            description={
              search || status
                ? 'Try a different search term or clear the status filter.'
                : showArchived
                  ? 'Archived projects keep their history and can be restored at any time.'
                  : 'Create your first project to start planning tasks, boards and timelines.'
            }
            action={
              !search && !status && !showArchived ? (
                <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
                  <Plus size={14} /> Create project
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {projects.map((project) => (
            <ProjectCard
              key={project._id}
              project={project}
              onOpen={(id) => navigate(`/projects/${id}`)}
              onEdit={(p) => { setEditing(p); setFormOpen(true); }}
              onArchive={(p) => setConfirm({ type: 'archive', project: p })}
              onRestore={(p) => setConfirm({ type: 'restore', project: p })}
              onDelete={(p) => setConfirm({ type: 'delete', project: p })}
            />
          ))}
        </div>
      )}

      <ProjectFormDialog
        isOpen={formOpen}
        project={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
      />

      <ConfirmDialog
        isOpen={confirm.type === 'archive'}
        onClose={() => setConfirm({ type: null, project: null })}
        onConfirm={() => archiveMutation.mutate(confirm.project)}
        title="Archive project"
        message={`“${confirm.project?.name}” will be hidden from the active projects list. You can restore it later.`}
        confirmLabel="Archive project"
        isPending={archiveMutation.isPending}
      />
      <ConfirmDialog
        isOpen={confirm.type === 'restore'}
        onClose={() => setConfirm({ type: null, project: null })}
        onConfirm={() => restoreMutation.mutate(confirm.project)}
        title="Restore project"
        message={`“${confirm.project?.name}” will be moved back to your active projects.`}
        confirmLabel="Restore project"
        isPending={restoreMutation.isPending}
      />
      <ConfirmDialog
        isOpen={confirm.type === 'delete'}
        onClose={() => setConfirm({ type: null, project: null })}
        onConfirm={() => deleteMutation.mutate(confirm.project)}
        title="Delete project"
        message={`“${confirm.project?.name}” and all of its tasks, comments and dependencies will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete permanently"
        danger
        isPending={deleteMutation.isPending}
      />
    </div>
  );
};

export default ProjectsPage;
