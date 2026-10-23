import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { FullPageLoader, Spinner } from '../../components/ui/Spinner';
import { Alert, extractError } from '../../components/ui/Alert';
import { workspacesApi, workspaceKeys } from '../../lib/taskApi';
import { formatDate } from '../../lib/format';
import { AuthShell } from '../../components/layout/AuthShell';

export const AcceptInvitePage = () => {
  const { token } = useParams();
  const { isAuthenticated, user } = useAuth();
  const { refetch: refetchWorkspaces } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(null);
  const [apiError, setApiError] = useState(null);

  const { data: invitation, isLoading, error } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => workspacesApi.getInvitation(token),
    enabled: Boolean(token) && isAuthenticated,
    retry: false,
  });

  const handleAccept = async () => {
    setAccepting(true);
    setApiError(null);
    try {
      await workspacesApi.acceptInvitation(token);
      setAccepted(invitation);
      await refetchWorkspaces();
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
    } catch (acceptError) {
      setApiError(extractError(acceptError));
    } finally {
      setAccepting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 ring-1 ring-primary-100">
            <Building2 size={22} className="text-primary-600" aria-hidden="true" />
          </div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-surface-900">You have an invitation</h1>
          <p className="mt-2 text-sm text-surface-500">
            Sign in or create an account with the invited email address to join the workspace.
          </p>
          <div className="mt-5 flex gap-2 justify-center">
            <Link to={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`} className="btn-primary">Sign in</Link>
            <Link to={`/register?redirect=${encodeURIComponent(`/invite/${token}`)}`} className="btn-secondary">Create account</Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (isLoading) return <FullPageLoader />;

  if (error) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-100 ring-1 ring-surface-200">
            <Mail size={22} className="text-surface-400" aria-hidden="true" />
          </div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-surface-900">Invitation unavailable</h1>
          <Alert
            type="error"
            message={extractError(error) || 'This invitation is invalid, already used, or has expired.'}
            className="mt-4 text-left"
          />
          <Link to="/dashboard" className="btn-secondary mt-4 inline-flex">Go to dashboard</Link>
        </div>
      </AuthShell>
    );
  }

  if (accepted) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
            <CheckCircle2 size={22} className="text-emerald-600" aria-hidden="true" />
          </div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-surface-900">You&apos;re in!</h1>
          <p className="mt-2 text-sm text-surface-500">
            You joined {accepted?.workspace?.name}. Taking you to your dashboard…
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="text-center">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl text-xl font-semibold text-white shadow-elevated ring-1 ring-white/50"
          style={{ backgroundColor: invitation?.workspace?.color || '#6366f1' }}
        >
          {invitation?.workspace?.name?.[0]?.toUpperCase() || 'W'}
        </div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-surface-900">Join {invitation?.workspace?.name}</h1>
        <p className="mt-2 text-sm text-surface-500">
          {invitation?.invitedBy?.name ? <><span className="font-medium text-surface-700">{invitation.invitedBy.name}</span> invited you</> : 'You were invited'} as a{' '}
          <span className="font-medium capitalize text-surface-700">{invitation?.role}</span>.
        </p>
        <p className="mt-2 text-2xs text-surface-400">
          Accepting as {user?.email}
          {invitation?.expiresAt ? ` · invitation expires ${formatDate(invitation.expiresAt, 'MMM d, yyyy')}` : ''}
        </p>

        <Alert type="error" message={apiError} className="mt-4 text-left" />

        <div className="mt-5 space-y-2">
          <button type="button" className="btn-primary w-full" onClick={handleAccept} disabled={accepting}>
            {accepting && <Spinner size={14} />} Accept invitation
          </button>
          <Link to="/dashboard" className="btn-ghost w-full text-surface-500">Not now</Link>
        </div>
      </div>
    </AuthShell>
  );
};

export default AcceptInvitePage;
