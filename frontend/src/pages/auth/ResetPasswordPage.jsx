import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import api from '../../lib/api';
import { FormField, Input } from '../../components/ui/Form';
import { Alert, extractError } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';
import { AuthShell } from '../../components/layout/AuthShell';

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
    <AuthShell>
      {done ? (
        <Alert type="success" message="Password reset! Redirecting to login…" />
      ) : (
        <>
          <div className="mb-6">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-surface-900">Set new password</h1>
            <p className="mt-1 text-sm text-surface-500">Choose a strong password you haven&apos;t used before.</p>
          </div>

          <Alert type="error" message={apiError} />

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <FormField label="New password" error={errors.password?.message} required id="new-password">
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPw ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="Min. 8 characters"
                  error={errors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 transition-colors hover:text-surface-600"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </FormField>

            <FormField label="Confirm password" error={errors.confirm?.message} required id="confirm-password">
              <Input id="confirm-password" type="password" {...register('confirm')} placeholder="Re-enter password" error={errors.confirm} />
            </FormField>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Spinner size={15} /> : 'Reset password'}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
};

export default ResetPasswordPage;
