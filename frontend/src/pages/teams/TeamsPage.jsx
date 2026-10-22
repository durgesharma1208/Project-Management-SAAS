import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Users, Trash2, Edit2, UserPlus } from 'lucide-react';
import api from '../../lib/api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { PageLoader, Spinner } from '../../components/ui/Spinner';
import { Avatar } from '../../components/ui/Avatar';
import { Dialog } from '../../components/ui/Dialog';
import { FormField, Input, Textarea } from '../../components/ui/Form';
import { Alert, extractError } from '../../components/ui/Alert';
import { useForm } from 'react-hook-form';

const CreateTeamDialog = ({ isOpen, onClose }) => {
  const { activeWorkspaceId } = useWorkspace();
  const qc = useQueryClient();
  const [apiError, setApiError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/workspaces/${activeWorkspaceId}/teams`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams', activeWorkspaceId] }); reset(); onClose(); },
    onError: (e) => setApiError(extractError(e)),
  });

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Create Team"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit(d => { setApiError(null); mutation.mutate(d); })} disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner size={14} /> : null} Create
          </button>
        </>
      }>
      <div className="space-y-4">
        <Alert type="error" message={apiError} />
        <FormField label="Team name" error={errors.name?.message} required id="team-name">
          <Input id="team-name" {...register('name', { required: 'Required' })} placeholder="Engineering" error={errors.name} />
        </FormField>
        <FormField label="Description" id="team-desc">
          <Textarea id="team-desc" {...register('description')} placeholder="What does this team work on?" rows={3} />
        </FormField>
      </div>
    </Dialog>
  );
};

const TeamCard = ({ team, members }) => (
  <div className="card p-5">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <span className="text-2xl">{team.emoji || '👥'}</span>
        <div>
          <h3 className="font-semibold text-surface-900">{team.name}</h3>
          {team.description && <p className="text-xs text-surface-500 mt-0.5">{team.description}</p>}
        </div>
      </div>
    </div>

    <div className="flex items-center gap-2 flex-wrap">
      {(team.members || []).map(m => (
        <div key={m._id || m.user?._id} className="flex items-center gap-1.5">
          <Avatar user={m.user || m} size="xs" />
          <span className="text-xs text-surface-600">{m.user?.name || m.name}</span>
          {m.role === 'lead' && <span className="badge bg-primary-50 text-primary-600 text-[9px]">Lead</span>}
        </div>
      ))}
      {(team.members || []).length === 0 && (
        <p className="text-xs text-surface-400">No members yet</p>
      )}
    </div>
  </div>
);

export const TeamsPage = () => {
  const { activeWorkspaceId } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['teams', activeWorkspaceId],
    queryFn: () => api.get(`/workspaces/${activeWorkspaceId}/teams`).then(r => r.data.data.teams),
    enabled: !!activeWorkspaceId,
  });

  const teams = data || [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-surface-900">Teams</h1>
          <p className="text-sm text-surface-500 mt-0.5">{teams.length} team{teams.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> New Team
        </button>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : teams.length === 0 ? (
        <div className="text-center py-20">
          <Users size={48} className="text-surface-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-surface-700 mb-2">No teams yet</h2>
          <p className="text-sm text-surface-400 mb-6">Create teams to organize your workspace members</p>
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Create a team
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {teams.map(t => <TeamCard key={t._id} team={t} />)}
        </div>
      )}

      <CreateTeamDialog isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};
