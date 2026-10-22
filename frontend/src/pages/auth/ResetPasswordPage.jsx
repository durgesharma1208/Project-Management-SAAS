import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Zap, Eye, EyeOff } from 'lucide-react';
import api from '../../lib/api';
import { FormField, Input } from '../../components/ui/Form';
import { Alert, extractError } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';

const schema = z.object({
  password: z.string().min(8, 'At least 8 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [done, setDone] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ password }) => {
    setApiError(null);
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (e) {
      setApiError(extractError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-primary-50/30 to-surface-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-elevated">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-surface-900">TaskFlow</span>
        </div>
        <div className="card p-8">
          {done ? (
            <Alert type="success" message="Password reset! Redirecting to login…" />
          ) : (
            <>
              <h1 className="text-2xl font-bold text-surface-900 mb-6">Set new password</h1>
              <Alert type="error" message={apiError} />
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <FormField label="New password" error={errors.password?.message} required>
                  <div className="relative">
                    <Input type={showPw ? 'text' : 'password'} {...register('password')} placeholder="Min. 8 characters" error={errors.password} />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </FormField>
                <FormField label="Confirm password" error={errors.confirm?.message} required>
                  <Input type="password" {...register('confirm')} placeholder="Re-enter password" error={errors.confirm} />
                </FormField>
                <button type="submit" className="btn-primary w-full" disabled={loading}>
                  {loading ? <Spinner size={15} /> : 'Reset password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
