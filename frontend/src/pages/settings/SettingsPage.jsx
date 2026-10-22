import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Building2, Copy, Mail, Shield, Trash2, UserPlus, UserRound, X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../components/ui/Toast';
import { PageHeader, PageSkeleton, ErrorState } from '../../components/ui/Primitives';
import { Tabs } from '../../components/ui/Tabs';
import { Avatar } from '../../components/ui/Avatar';
import { Dialog } from '../../components/ui/Dialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FormField, Input, Select, Textarea } from '../../components/ui/Form';
import { Spinner } from '../../components/ui/Spinner';
import { Alert, extractError } from '../../components/ui/Alert';
import {
  usersApi, workspacesApi, workspaceKeys,
} from '../../lib/taskApi';
import { PROJECT_COLORS } from '../../lib/constants';
import { formatDate } from '../../lib/format';

const InviteDialog = ({ isOpen, onClose }) => {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) { setEmail(''); setRole('member'); setResult(null); setError(null); }
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: () => workspacesApi.invite(activeWorkspaceId, { email, role }),
    onSuccess: (invitation) => {
      setResult(invitation);
      queryClient.invalidateQueries({ queryKey: workspaceKeys.invitations(activeWorkspaceId) });
      toast.success('Invitation created');
    },
    onError: (apiError) => setError(extractError(apiError)),
  });

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Invite a member"
      description="They will receive a link to join this workspace."
      footer={
        result ? (
          <button type="button" className="btn-primary" onClick={onClose}>Done</button>
        ) : (
          <>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" onClick={() => mutation.mutate()} disabled={!email || mutation.isPending}>
              {mutation.isPending ? <Spinner size={14} /> : <Mail size={14} />} Send invite
            </button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <Alert type="success" message={`Invitation ready for ${result.email}. Share this link with them.`} />
          <div className="rounded-lg border border-surface-200 bg-surface-50 p-3">
            <p className="text-2xs text-surface-500 mb-1">Invitation link (also printed to the server console in development)</p>
            <p className="text-xs font-mono text-surface-800 break-all">{result.inviteUrl}</p>
          </div>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(result.inviteUrl);
                toast.success('Link copied');
              } catch {
                toast.error('Copy failed — select the link manually');
              }
            }}
          >
            <Copy size={13} /> Copy link
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <Alert type="error" message={error} />
          <FormField label="Email address" required id="invite-email">
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              autoFocus
            />
          </FormField>
          <FormField label="Role" id="invite-role">
            <Select id="invite-role" value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="member">Member — can work on projects</option>
              <option value="admin">Admin — can manage workspace and members</option>
            </Select>
          </FormField>
        </div>
      )}
    </Dialog>
  );
};

const WorkspaceTab = () => {
  const { activeWorkspace, activeWorkspaceId, refetch, canManageWorkspace } = useWorkspace();
  const toast = useToast();
  const [apiError, setApiError] = useState(null);
  const [color, setColor] = useState(activeWorkspace?.color || PROJECT_COLORS[0]);
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm({
    defaultValues: {
      name: activeWorkspace?.name || '',
      description: activeWorkspace?.description || '',
    },
  });

  useEffect(() => {
    reset({ name: activeWorkspace?.name || '', description: activeWorkspace?.description || '' });
    setColor(activeWorkspace?.color || PROJECT_COLORS[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?._id]);

  const mutation = useMutation({
    mutationFn: (values) => workspacesApi.update(activeWorkspaceId, values),
    onSuccess: () => {
      refetch();
      toast.success('Workspace updated');
      setApiError(null);
    },
    onError: (error) => setApiError(extractError(error)),
  });

  return (
    <div className="max-w-2xl space-y-4">
      <section className="card p-4">
        <h2 className="section-title mb-3">Workspace details</h2>
        <form
          className="space-y-3"
          onSubmit={handleSubmit((values) => mutation.mutate({ ...values, color }))}
        >
          <Alert type="error" message={apiError} />
          <FormField label="Name" required id="ws-settings-name" error={errors.name?.message}>
            <Input
              id="ws-settings-name"
              {...register('name', { required: 'A workspace name is required' })}
              disabled={!canManageWorkspace}
              error={errors.name}
            />
          </FormField>
          <FormField label="Description" id="ws-settings-desc">
            <Textarea id="ws-settings-desc" rows={2} {...register('description')} disabled={!canManageWorkspace} />
          </FormField>
          <div>
            <p className="label">Accent colour</p>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={!canManageWorkspace}
                  onClick={() => setColor(option)}
                  aria-label={`Use colour ${option}`}
                  aria-pressed={color === option}
                  className={`w-6 h-6 rounded-full transition ${color === option ? 'ring-2 ring-offset-2 ring-surface-400' : ''}`}
                  style={{ backgroundColor: option }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button type="submit" className="btn-primary" disabled={!canManageWorkspace || mutation.isPending || !isDirty && color === activeWorkspace?.color}>
              {mutation.isPending && <Spinner size={14} />} Save changes
            </button>
            <span className="text-2xs text-surface-400">
              {canManageWorkspace ? `Created ${formatDate(activeWorkspace?.createdAt, 'MMM d, yyyy')}` : 'Only admins can edit workspace details.'}
            </span>
          </div>
        </form>
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-1">Your access</h2>
        <div className="flex items-center gap-2 text-[13px] text-surface-600">
          <Shield size={14} className="text-surface-400" />
          You are the <span className="font-medium capitalize text-surface-900">{activeWorkspace?.role}</span> of this workspace.
        </div>
      </section>
    </div>
  );
};

const MembersTab = () => {
  const { activeWorkspaceId, canManageWorkspace, isOwner } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const { data: members = [], isLoading, isError, refetch } = useQuery({
    queryKey: workspaceKeys.members(activeWorkspaceId),
    queryFn: () => workspacesApi.members(activeWorkspaceId),
    enabled: Boolean(activeWorkspaceId),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: workspaceKeys.invitations(activeWorkspaceId),
    queryFn: () => workspacesApi.invitations(activeWorkspaceId),
    enabled: Boolean(activeWorkspaceId) && canManageWorkspace,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: workspaceKeys.members(activeWorkspaceId) });
    queryClient.invalidateQueries({ queryKey: workspaceKeys.invitations(activeWorkspaceId) });
  };

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }) => workspacesApi.updateMemberRole(activeWorkspaceId, memberId, role),
    onSuccess: () => { invalidate(); toast.success('Role updated'); },
    onError: (error) => toast.error(extractError(error)),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId) => workspacesApi.removeMember(activeWorkspaceId, memberId),
    onSuccess: () => { invalidate(); setConfirm(null); toast.success('Member removed'); },
    onError: (error) => toast.error(extractError(error)),
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId) => workspacesApi.revokeInvitation(activeWorkspaceId, invitationId),
    onSuccess: () => { invalidate(); toast.success('Invitation revoked'); },
    onError: (error) => toast.error(extractError(error)),
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Members</h2>
          <p className="text-xs text-surface-500">{members.length} people have access to this workspace.</p>
        </div>
        {canManageWorkspace && (
          <button type="button" className="btn-primary btn-sm" onClick={() => setInviteOpen(true)}>
            <UserPlus size={13} /> Invite member
          </button>
        )}
      </div>

      {isLoading ? (
        <PageSkeleton cards={1} />
      ) : isError ? (
        <ErrorState message="Members could not be loaded." onRetry={refetch} />
      ) : (
        <div className="card divide-y divide-surface-100">
          {members.map((membership) => {
            const isSelf = membership.user?._id === user?._id;
            return (
              <div key={membership._id} className="flex items-center gap-3 px-4 py-3">
                <Avatar user={membership.user} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-surface-900 truncate">
                    {membership.user?.name} {isSelf && <span className="text-2xs text-surface-400">(you)</span>}
                  </p>
                  <p className="text-2xs text-surface-400 truncate">{membership.user?.email}</p>
                </div>

                {canManageWorkspace && membership.role !== 'owner' && !isSelf ? (
                  <Select
                    value={membership.role}
                    onChange={(event) => roleMutation.mutate({ memberId: membership._id, role: event.target.value })}
                    className="w-auto input-sm"
                    aria-label={`Role for ${membership.user?.name}`}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </Select>
                ) : (
                  <span className={`badge capitalize ${
                    membership.role === 'owner'
                      ? 'bg-amber-50 text-amber-700'
                      : membership.role === 'admin'
                        ? 'bg-primary-50 text-primary-700'
                        : 'bg-surface-100 text-surface-600'
                  }`}>
                    {membership.role}
                  </span>
                )}

                {canManageWorkspace && membership.role !== 'owner' && !isSelf && (
                  <button
                    type="button"
                    className="btn-icon text-red-500 hover:bg-red-50"
                    onClick={() => setConfirm(membership)}
                    aria-label={`Remove ${membership.user?.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canManageWorkspace && invitations.length > 0 && (
        <section className="card">
          <header className="px-4 h-11 flex items-center justify-between border-b border-surface-100">
            <h2 className="section-title">Pending invitations</h2>
            <span className="text-2xs text-surface-400">{invitations.length}</span>
          </header>
          <div className="divide-y divide-surface-100">
            {invitations.map((invitation) => (
              <div key={invitation._id} className="flex items-center gap-2 px-4 py-2.5">
                <Mail size={14} className="text-surface-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-surface-800 truncate">{invitation.email}</p>
                  <p className="text-2xs text-surface-400">
                    {invitation.role} · expires {formatDate(invitation.expiresAt, 'MMM d')}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost btn-sm text-surface-500"
                  onClick={() => revokeMutation.mutate(invitation._id)}
                >
                  <X size={12} /> Revoke
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {isOwner && (
        <p className="text-2xs text-surface-400">
          As the owner you keep full access. Transfer ownership is not supported yet — ask the owner to change roles.
        </p>
      )}

      <InviteDialog isOpen={inviteOpen} onClose={() => setInviteOpen(false)} />
      <ConfirmDialog
        isOpen={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => removeMutation.mutate(confirm._id)}
        title="Remove member"
        message={`${confirm?.user?.name} will lose access to this workspace. Their assigned tasks stay in place.`}
        confirmLabel="Remove member"
        danger
        isPending={removeMutation.isPending}
      />
    </div>
  );
};

const ProfileTab = () => {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [profileError, setProfileError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  const profileForm = useForm({
    defaultValues: {
      name: user?.name || '',
      jobTitle: user?.jobTitle || '',
      bio: user?.bio || '',
      avatar: user?.avatar || '',
    },
  });

  const passwordForm = useForm();

  const profileMutation = useMutation({
    mutationFn: (values) => usersApi.updateProfile({ ...values, avatar: values.avatar || null }),
    onSuccess: (updated) => {
      updateUser(updated);
      setProfileError(null);
      toast.success('Profile updated');
    },
    onError: (error) => setProfileError(extractError(error)),
  });

  const passwordMutation = useMutation({
    mutationFn: (values) => usersApi.changePassword(values),
    onSuccess: () => {
      passwordForm.reset();
      setPasswordError(null);
      toast.success('Password changed');
    },
    onError: (error) => setPasswordError(extractError(error)),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-4xl">
      <div className="lg:col-span-2 space-y-4">
        <section className="card p-4">
          <h2 className="section-title mb-3">Profile information</h2>
          <form
            className="space-y-3"
            onSubmit={profileForm.handleSubmit((values) => {
              setProfileError(null);
              profileMutation.mutate(values);
            })}
          >
            <Alert type="error" message={profileError} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Full name" required id="profile-name" error={profileForm.formState.errors.name?.message}>
                <Input
                  id="profile-name"
                  {...profileForm.register('name', { required: 'A name is required' })}
                  error={profileForm.formState.errors.name}
                />
              </FormField>
              <FormField label="Job title" id="profile-job">
                <Input id="profile-job" {...profileForm.register('jobTitle')} placeholder="Product manager" />
              </FormField>
            </div>
            <FormField label="Bio" id="profile-bio" hint="Shown to workspace members on shared views.">
              <Textarea id="profile-bio" rows={3} {...profileForm.register('bio')} placeholder="A short introduction" />
            </FormField>
            <FormField label="Avatar URL" id="profile-avatar" hint="Optional. Leave empty to use your initials.">
              <Input id="profile-avatar" {...profileForm.register('avatar')} placeholder="https://…" />
            </FormField>
            <button type="submit" className="btn-primary" disabled={profileMutation.isPending}>
              {profileMutation.isPending && <Spinner size={14} />} Save changes
            </button>
          </form>
        </section>

        <section className="card p-4">
          <h2 className="section-title mb-3">Change password</h2>
          <form
            className="space-y-3"
            onSubmit={passwordForm.handleSubmit((values) => {
              setPasswordError(null);
              passwordMutation.mutate(values);
            })}
          >
            <Alert type="error" message={passwordError} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Current password" required id="profile-current">
                <Input
                  id="profile-current"
                  type="password"
                  {...passwordForm.register('currentPassword', { required: 'Enter your current password' })}
                  error={passwordForm.formState.errors.currentPassword}
                />
              </FormField>
              <FormField label="New password" required id="profile-new" hint="At least 8 characters.">
                <Input
                  id="profile-new"
                  type="password"
                  {...passwordForm.register('newPassword', {
                    required: 'Choose a new password',
                    minLength: { value: 8, message: 'At least 8 characters' },
                  })}
                  error={passwordForm.formState.errors.newPassword}
                />
              </FormField>
            </div>
            <button type="submit" className="btn-primary" disabled={passwordMutation.isPending}>
              {passwordMutation.isPending && <Spinner size={14} />} Change password
            </button>
            <p className="text-2xs text-surface-400">
              Changing your password signs out other sessions.
            </p>
          </form>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="card p-4 text-center">
          <Avatar user={user} size="xl" className="mx-auto" />
          <p className="text-[13px] font-semibold text-surface-900 mt-2">{user?.name}</p>
          <p className="text-2xs text-surface-500">{user?.email}</p>
          {user?.jobTitle && <p className="text-2xs text-surface-400 mt-1">{user.jobTitle}</p>}
          <p className="text-2xs text-surface-400 mt-2">
            Member since {formatDate(user?.createdAt, 'MMM yyyy')}
          </p>
        </section>
      </aside>
    </div>
  );
};

export const SettingsPage = ({ defaultTab = 'workspace' }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get('tab') || defaultTab;
  const [tab, setTab] = useState(['workspace', 'members', 'profile'].includes(initial) ? initial : defaultTab);

  const changeTab = (value) => {
    setTab(value);
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="page">
      <PageHeader
        title="Settings"
        description="Manage your workspace, team access and personal account."
      />

      <Tabs
        className="mb-5"
        value={tab}
        onChange={changeTab}
        tabs={[
          { id: 'workspace', label: 'Workspace', icon: Building2 },
          { id: 'members', label: 'Members', icon: Shield },
          { id: 'profile', label: 'My profile', icon: UserRound },
        ]}
      />

      {tab === 'workspace' && <WorkspaceTab />}
      {tab === 'members' && <MembersTab />}
      {tab === 'profile' && <ProfileTab />}
    </div>
  );
};

export default SettingsPage;
