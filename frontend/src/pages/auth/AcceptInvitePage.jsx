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
      <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
            <Building2 size={22} className="text-primary-600" />
          </div>
          <h1 className="text-lg font-semibold text-surface-900 mb-1.5">You have an invitation</h1>
          <p className="text-[13px] text-surface-500 mb-5">
            Sign in or create an account with the invited email address to join the workspace.
          </p>
          <div className="flex gap-2 justify-center">
            <Link to={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`} className="btn-primary">Sign in</Link>
            <Link to={`/register?redirect=${encodeURIComponent(`/invite/${token}`)}`} className="btn-secondary">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) return <FullPageLoader />;

  if (error) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <Mail size={36} className="text-surface-300 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-surface-900 mb-1.5">Invitation unavailable</h1>
          <Alert type="error" message={extractError(error) || 'This invitation is invalid, already used, or has expired.'} className="text-left" />
          <Link to="/dashboard" className="btn-secondary mt-4 inline-flex">Go to dashboard</Link>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-surface-900 mb-1.5">You're in!</h1>
          <p className="text-[13px] text-surface-500">You joined {accepted?.workspace?.name}. Taking you to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 text-xl font-semibold text-white"
          style={{ backgroundColor: invitation?.workspace?.color || '#6366f1' }}
        >
          {invitation?.workspace?.name?.[0]?.toUpperCase() || 'W'}
        </div>
        <h1 className="text-lg font-semibold text-surface-900 mb-1.5">Join {invitation?.workspace?.name}</h1>
        <p className="text-[13px] text-surface-500">
          {invitation?.invitedBy?.name ? <><span className="font-medium text-surface-700">{invitation.invitedBy.name}</span> invited you</> : 'You were invited'} as a{' '}
          <span className="font-medium capitalize text-surface-700">{invitation?.role}</span>.
        </p>
        <p className="text-2xs text-surface-400 mt-1.5">
          Accepting as {user?.email}
          {invitation?.expiresAt ? ` · invitation expires ${formatDate(invitation.expiresAt, 'MMM d, yyyy')}` : ''}
        </p>

        <Alert type="error" message={apiError} className="text-left mt-4" />

        <div className="mt-5 space-y-2">
          <button type="button" className="btn-primary w-full" onClick={handleAccept} disabled={accepting}>
            {accepting && <Spinner size={14} />} Accept invitation
          </button>
          <Link to="/dashboard" className="btn-ghost w-full text-surface-500">Not now</Link>
        </div>
      </div>
    </div>
  );
};

export default AcceptInvitePage;
