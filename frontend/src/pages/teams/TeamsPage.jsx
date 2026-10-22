import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { MoreHorizontal, Pencil, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useMembers } from '../../hooks/useMembers';
import { useToast } from '../../components/ui/Toast';
import { EmptyState, ErrorState, PageHeader, PageSkeleton } from '../../components/ui/Primitives';
import { Avatar } from '../../components/ui/Avatar';
import { Dialog } from '../../components/ui/Dialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FormField, Input, Select, Textarea } from '../../components/ui/Form';
import { Popover, MenuItem } from '../../components/ui/Menu';
import { Spinner } from '../../components/ui/Spinner';
import { teamsApi, teamKeys } from '../../lib/taskApi';
import { TEAM_EMOJIS } from '../../lib/constants';
import { Alert, extractError } from '../../components/ui/Alert';

const TeamFormDialog = ({ isOpen, onClose, team = null }) => {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [emoji, setEmoji] = useState(team?.emoji || '👥');
  const [apiError, setApiError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { name: team?.name || '', description: team?.description || '' },
  });

  useEffect(() => {
    if (!isOpen) return;
    reset({ name: team?.name || '', description: team?.description || '' });
    setEmoji(team?.emoji || '👥');
    setApiError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, team?._id]);

  const mutation = useMutation({
    mutationFn: (values) => (team
      ? teamsApi.update(activeWorkspaceId, team._id, values)
      : teamsApi.create(activeWorkspaceId, values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all(activeWorkspaceId) });
      toast.success(team ? 'Team updated' : 'Team created');
      onClose();
    },
    onError: (error) => setApiError(extractError(error)),
  });

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={team ? 'Edit team' : 'New team'}
      description="Teams group workspace members who work together."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit((values) => {
              setApiError(null);
              mutation.mutate({ ...values, emoji });
            })}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Spinner size={14} />}
            {team ? 'Save changes' : 'Create team'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Alert type="error" message={apiError} />
        <div>
          <p className="label">Icon</p>
          <div className="flex flex-wrap gap-1">
            {TEAM_EMOJIS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setEmoji(option)}
                aria-pressed={emoji === option}
                aria-label={`Use ${option} as team icon`}
                className={`w-8 h-8 rounded-lg text-base flex items-center justify-center ${
                  emoji === option ? 'bg-primary-50 ring-1 ring-primary-400' : 'hover:bg-surface-100'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <FormField label="Team name" required id="team-name" error={errors.name?.message}>
          <Input id="team-name" {...register('name', { required: 'A team name is required' })} placeholder="Engineering" error={errors.name} />
        </FormField>
        <FormField label="Description" id="team-desc">
          <Textarea id="team-desc" rows={2} {...register('description')} placeholder="What does this team own?" />
        </FormField>
      </div>
    </Dialog>
  );
};

const AddMemberDialog = ({ isOpen, onClose, team }) => {
  const { activeWorkspaceId } = useWorkspace();
  const { users } = useMembers();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('member');

  useEffect(() => { if (isOpen) { setUserId(''); setRole('member'); } }, [isOpen]);

  const available = users.filter((user) => !(team?.members || []).some((member) => (member.user?._id || member.user) === user._id));

  const mutation = useMutation({
    mutationFn: () => teamsApi.addMember(activeWorkspaceId, team._id, { userId, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all(activeWorkspaceId) });
      toast.success('Team member added');
      onClose();
    },
    onError: (error) => toast.error(extractError(error)),
  });

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Add member to ${team?.name || 'team'}`}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={!userId || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Spinner size={14} />} Add member
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="Workspace member" required id="team-member">
          <Select id="team-member" value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="">Select a member…</option>
            {available.map((user) => <option key={user._id} value={user._id}>{user.name} ({user.email})</option>)}
          </Select>
        </FormField>
        <FormField label="Team role" id="team-role">
          <Select id="team-role" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="member">Member</option>
            <option value="lead">Lead</option>
          </Select>
        </FormField>
        {available.length === 0 && (
          <p className="text-xs text-surface-500">Everyone in the workspace is already on this team.</p>
        )}
      </div>
    </Dialog>
  );
};

export const TeamsPage = () => {
  const { activeWorkspaceId, canManageWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [addMemberFor, setAddMemberFor] = useState(null);
  const [teamToDelete, setTeamToDelete] = useState(null);

  const { data: teams = [], isLoading, isError, refetch } = useQuery({
    queryKey: teamKeys.all(activeWorkspaceId),
    queryFn: () => teamsApi.list(activeWorkspaceId),
    enabled: Boolean(activeWorkspaceId),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: teamKeys.all(activeWorkspaceId) });

  const removeMemberMutation = useMutation({
    mutationFn: ({ teamId, memberId }) => teamsApi.removeMember(activeWorkspaceId, teamId, memberId),
    onSuccess: () => { refresh(); toast.success('Member removed from team'); },
    onError: (error) => toast.error(extractError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (team) => teamsApi.remove(activeWorkspaceId, team._id),
    onSuccess: () => { refresh(); setTeamToDelete(null); toast.success('Team deleted'); },
    onError: (error) => toast.error(extractError(error)),
  });

  return (
    <div className="page">
      <PageHeader
        title="Teams"
        description="Group members into teams to organise how work is assigned."
        actions={canManageWorkspace && (
          <button type="button" className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus size={14} /> New team
          </button>
        )}
      />

      {isLoading ? (
        <PageSkeleton cards={2} />
      ) : isError ? (
        <ErrorState message="Teams could not be loaded." onRetry={refetch} />
      ) : teams.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title="No teams yet"
            description="Create a team to group workspace members by function, squad or project."
            action={canManageWorkspace ? (
              <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
                <Plus size={14} /> Create a team
              </button>
            ) : null}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {teams.map((team) => (
            <article key={team._id} className="card p-4 flex flex-col">
              <div className="flex items-start gap-2.5">
                <span className="w-9 h-9 rounded-lg bg-surface-100 flex items-center justify-center text-lg flex-shrink-0">
                  {team.emoji || '👥'}
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[14px] font-semibold text-surface-900 truncate">{team.name}</h2>
                  <p className="text-2xs text-surface-400">
                    {(team.members || []).length} {(team.members || []).length === 1 ? 'member' : 'members'}
                  </p>
                </div>
                {canManageWorkspace && (
                  <Popover
                    width="w-[184px]"
                    trigger={({ toggle }) => (
                      <button type="button" className="btn-icon" onClick={toggle} aria-label={`Actions for ${team.name}`}>
                        <MoreHorizontal size={16} />
                      </button>
                    )}
                  >
                    {({ close }) => (
                      <>
                        <MenuItem icon={Pencil} onClick={() => { close(); setEditing(team); setFormOpen(true); }}>Edit team</MenuItem>
                        <MenuItem icon={UserPlus} onClick={() => { close(); setAddMemberFor(team); }}>Add member</MenuItem>
                        <div className="my-1 border-t border-surface-100" />
                        <MenuItem icon={Trash2} danger onClick={() => { close(); setTeamToDelete(team); }}>Delete team</MenuItem>
                      </>
                    )}
                  </Popover>
                )}
              </div>

              {team.description && <p className="text-xs text-surface-500 mt-2 line-clamp-2">{team.description}</p>}

              <div className="mt-3 space-y-1.5 flex-1">
                {(team.members || []).length === 0 && (
                  <p className="text-xs text-surface-400">No members yet.</p>
                )}
                {(team.members || []).map((member) => {
                  const person = member.user || member;
                  return (
                    <div key={member._id || person._id} className="group flex items-center gap-2">
                      <Avatar user={person} size="xs" />
                      <span className="text-xs text-surface-700 truncate flex-1">{person.name}</span>
                      {member.role === 'lead' && <span className="badge bg-primary-50 text-primary-700">Lead</span>}
                      {canManageWorkspace && (
                        <button
                          type="button"
                          onClick={() => removeMemberMutation.mutate({ teamId: team._id, memberId: member._id })}
                          className="opacity-0 group-hover:opacity-100 text-surface-300 hover:text-red-500 transition"
                          aria-label={`Remove ${person.name} from ${team.name}`}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {canManageWorkspace && (
                <button
                  type="button"
                  className="btn-secondary btn-sm mt-3 justify-center"
                  onClick={() => setAddMemberFor(team)}
                >
                  <UserPlus size={13} /> Add member
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      <TeamFormDialog isOpen={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} team={editing} />
      {addMemberFor && (
        <AddMemberDialog isOpen={Boolean(addMemberFor)} onClose={() => setAddMemberFor(null)} team={addMemberFor} />
      )}
      <ConfirmDialog
        isOpen={Boolean(teamToDelete)}
        onClose={() => setTeamToDelete(null)}
        onConfirm={() => deleteMutation.mutate(teamToDelete)}
        title="Delete team"
        message={`“${teamToDelete?.name}” will be removed. Projects linked to it are not deleted.`}
        confirmLabel="Delete team"
        danger
        isPending={deleteMutation.isPending}
      />
    </div>
  );
};

export default TeamsPage;
