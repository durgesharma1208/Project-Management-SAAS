import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Settings, Users, UserPlus, Shield, Trash2, Mail } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { PageLoader, Spinner } from '../../components/ui/Spinner';
import { Avatar } from '../../components/ui/Avatar';
import { Dialog } from '../../components/ui/Dialog';
import { FormField, Input, Select, Textarea } from '../../components/ui/Form';
import { Alert, extractError } from '../../components/ui/Alert';
import { useForm } from 'react-hook-form';

const InviteDialog = ({ isOpen, onClose }) => {
  const { activeWorkspaceId } = useWorkspace();
  const [apiError, setApiError] = useState(null);
  const [inviteLink, setInviteLink] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ defaultValues: { role: 'member' } });

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/workspaces/${activeWorkspaceId}/invitations`, data).then(r => r.data.data.invitation),
    onSuccess: (inv) => { setInviteLink(inv.inviteUrl); reset(); },
    onError: (e) => setApiError(extractError(e)),
  });

  const handleClose = () => { setInviteLink(null); setApiError(null); onClose(); };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Invite Member">
      <div className="space-y-4">
        {inviteLink ? (
          <div className="space-y-3">
            <Alert type="success" message="Invitation sent! Share this link or check the server console." />
            <div className="bg-surface-50 border border-surface-200 rounded-lg p-3">
              <p className="text-xs text-surface-500 mb-1">Invitation link:</p>
              <p className="text-xs font-mono text-surface-800 break-all">{inviteLink}</p>
            </div>
            <button className="btn-primary w-full" onClick={handleClose}>Done</button>
          </div>
        ) : (
          <>
            <Alert type="error" message={apiError} />
            <FormField label="Email address" error={errors.email?.message} required id="inv-email">
              <Input id="inv-email" type="email" {...register('email', { required: 'Email is required' })} placeholder="colleague@example.com" error={errors.email} />
            </FormField>
            <FormField label="Role" id="inv-role">
              <Select id="inv-role" {...register('role')}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </Select>
            </FormField>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn-primary" onClick={handleSubmit(d => { setApiError(null); mutation.mutate(d); })} disabled={mutation.isPending}>
                {mutation.isPending ? <Spinner size={14} /> : <><Mail size={13} /> Send invite</>}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};

export const SettingsPage = () => {
  const { user, updateUser } = useAuth();
  const { activeWorkspace, activeWorkspaceId, refetch } = useWorkspace();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'workspace');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [pwSuccess, setPwSuccess] = useState(null);
  const [pwError, setPwError] = useState(null);

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['members', activeWorkspaceId],
    queryFn: () => api.get(`/workspaces/${activeWorkspaceId}/members`).then(r => r.data.data.members),
    enabled: !!activeWorkspaceId && activeTab === 'members',
  });

  const profileForm = useForm({ defaultValues: { name: user?.name || '', bio: user?.bio || '', jobTitle: user?.jobTitle || '' } });
  const pwForm = useForm();

  const profileMutation = useMutation({
    mutationFn: (data) => api.patch('/users/profile', data).then(r => r.data.data.user),
    onSuccess: (u) => { updateUser(u); setProfileSuccess('Profile updated'); },
    onError: (e) => setProfileError(extractError(e)),
  });

  const pwMutation = useMutation({
    mutationFn: (data) => api.post('/users/change-password', data),
    onSuccess: () => { setPwSuccess('Password changed'); pwForm.reset(); },
    onError: (e) => setPwError(extractError(e)),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId) => api.delete(`/workspaces/${activeWorkspaceId}/members/${memberId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', activeWorkspaceId] }),
  });

  const TABS = [
    { id: 'workspace', label: 'Workspace', icon: Settings },
    { id: 'members',   label: 'Members',   icon: Users },
    { id: 'profile',   label: 'My Profile', icon: Shield },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-surface-900">Settings</h1>
        <p className="text-sm text-surface-500 mt-0.5">Manage your workspace and profile</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-200 mb-6">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id ? 'border-primary-600 text-primary-700' : 'border-transparent text-surface-500 hover:text-surface-900'
            }`}>
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Workspace tab */}
      {activeTab === 'workspace' && activeWorkspace && (
        <div className="space-y-5 max-w-xl">
          <div className="card p-5">
            <h2 className="font-semibold text-surface-900 mb-4">Workspace Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-surface-100">
                <span className="text-surface-500">Name</span>
                <span className="text-surface-900 font-medium">{activeWorkspace.name}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-surface-100">
                <span className="text-surface-500">Your role</span>
                <span className="capitalize text-surface-900 font-medium">{activeWorkspace.role}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-surface-500">Workspace ID</span>
                <span className="text-xs font-mono text-surface-400">{activeWorkspace._id}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Members tab */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-surface-900">Workspace Members</h2>
            <button className="btn-primary btn-sm" onClick={() => setInviteOpen(true)}>
              <UserPlus size={13} /> Invite member
            </button>
          </div>

          {membersLoading ? <PageLoader /> : (
            <div className="card divide-y divide-surface-100">
              {(membersData || []).map(m => (
                <div key={m._id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar user={m.user} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900">{m.user?.name}</p>
                    <p className="text-xs text-surface-400">{m.user?.email}</p>
                  </div>
                  <span className={`badge capitalize ${
                    m.role === 'owner' ? 'bg-amber-50 text-amber-700' :
                    m.role === 'admin' ? 'bg-blue-50 text-blue-700' :
                    'bg-surface-100 text-surface-600'
                  }`}>{m.role}</span>
                  {m.role !== 'owner' && (
                    <button
                      className="btn-ghost p-1.5 text-red-500 hover:bg-red-50"
                      onClick={() => removeMemberMutation.mutate(m._id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <div className="space-y-5 max-w-xl">
          {/* Profile info */}
          <div className="card p-5">
            <h2 className="font-semibold text-surface-900 mb-4">Profile Information</h2>
            <Alert type="success" message={profileSuccess} dismissible onDismiss={() => setProfileSuccess(null)} />
            <Alert type="error" message={profileError} dismissible onDismiss={() => setProfileError(null)} />
            <form onSubmit={profileForm.handleSubmit(d => { setProfileError(null); setProfileSuccess(null); profileMutation.mutate(d); })} className="space-y-4 mt-3">
              <FormField label="Full name" id="pf-name">
                <Input id="pf-name" {...profileForm.register('name')} />
              </FormField>
              <FormField label="Job title" id="pf-job">
                <Input id="pf-job" {...profileForm.register('jobTitle')} placeholder="Senior Engineer" />
              </FormField>
              <FormField label="Bio" id="pf-bio">
                <Textarea id="pf-bio" {...profileForm.register('bio')} placeholder="Tell your team about yourself" rows={3} />
              </FormField>
              <button type="submit" className="btn-primary" disabled={profileMutation.isPending}>
                {profileMutation.isPending ? <Spinner size={14} /> : 'Save changes'}
              </button>
            </form>
          </div>

          {/* Change password */}
          <div className="card p-5">
            <h2 className="font-semibold text-surface-900 mb-4">Change Password</h2>
            <Alert type="success" message={pwSuccess} dismissible onDismiss={() => setPwSuccess(null)} />
            <Alert type="error" message={pwError} dismissible onDismiss={() => setPwError(null)} />
            <form onSubmit={pwForm.handleSubmit(d => { setPwError(null); setPwSuccess(null); pwMutation.mutate(d); })} className="space-y-4 mt-3">
              <FormField label="Current password" id="pw-curr">
                <Input id="pw-curr" type="password" {...pwForm.register('currentPassword', { required: true })} />
              </FormField>
              <FormField label="New password" id="pw-new">
                <Input id="pw-new" type="password" {...pwForm.register('newPassword', { required: true, minLength: 8 })} />
              </FormField>
              <button type="submit" className="btn-primary" disabled={pwMutation.isPending}>
                {pwMutation.isPending ? <Spinner size={14} /> : 'Change password'}
              </button>
            </form>
          </div>
        </div>
      )}

      <InviteDialog isOpen={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
};
