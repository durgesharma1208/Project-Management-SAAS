import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2 } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { PageLoader, Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';

export const AcceptInvitePage = () => {
  const { token } = useParams();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Load invitation info
  const { data, isLoading, error } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.get(`/workspaces/invitations/${token}`).then(r => r.data.data.invitation),
    enabled: !!token && isAuthenticated,
    retry: false,
  });

  const handleAccept = async () => {
    try {
      await api.post(`/workspaces/invitations/${token}/accept`);
      navigate('/dashboard');
    } catch (e) {
      // handled by query error
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <Building2 size={40} className="text-primary-500 mx-auto mb-4" />
          <h2 className="font-semibold text-surface-900 text-lg mb-2">You have an invitation!</h2>
          <p className="text-sm text-surface-500 mb-5">Please sign in or create an account to accept it.</p>
          <div className="flex gap-3 justify-center">
            <Link to={`/login?redirect=/invite/${token}`} className="btn-primary">Sign in</Link>
            <Link to={`/register?redirect=/invite/${token}`} className="btn-secondary">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) return <PageLoader />;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <Alert type="error" message={error?.response?.data?.message || 'Invitation not found or expired'} />
          <Link to="/dashboard" className="btn-secondary mt-4 inline-flex">Go to dashboard</Link>
        </div>
      </div>
    );
  }

  const invitation = data;

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl text-white font-bold"
          style={{ backgroundColor: invitation?.workspace?.color || '#6366f1' }}>
          {invitation?.workspace?.name?.[0] || 'W'}
        </div>
        <h2 className="text-xl font-bold text-surface-900 mb-1">Join {invitation?.workspace?.name}</h2>
        <p className="text-sm text-surface-500 mb-2">
          <span className="font-medium">{invitation?.invitedBy?.name}</span> has invited you as a{' '}
          <span className="font-medium capitalize">{invitation?.role}</span>.
        </p>
        <p className="text-xs text-surface-400 mb-6">Accepting as: {user?.email}</p>
        <button className="btn-primary w-full" onClick={handleAccept}>
          Accept Invitation
        </button>
        <Link to="/dashboard" className="btn-ghost w-full mt-2 text-surface-500 text-sm">
          Decline
        </Link>
      </div>
    </div>
  );
};
