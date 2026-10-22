import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Zap, ArrowLeft } from 'lucide-react';
import api from '../../lib/api';
import { FormField, Input } from '../../components/ui/Form';
import { Alert, extractError } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';

const schema = z.object({ email: z.string().email('Invalid email') });

export const ForgotPasswordPage = () => {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }) => {
    setApiError(null);
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
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
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📧</span>
              </div>
              <h2 className="text-lg font-semibold text-surface-900 mb-2">Check your email</h2>
              <p className="text-sm text-surface-500">If that email exists, we've sent a reset link. Check the server console if email is not configured.</p>
              <Link to="/login" className="btn-primary mt-5 inline-flex">Back to login</Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-surface-900">Reset password</h1>
                <p className="text-surface-500 mt-1 text-sm">Enter your email and we'll send a reset link</p>
              </div>
              <Alert type="error" message={apiError} />
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <FormField label="Email address" error={errors.email?.message} required id="email">
                  <Input id="email" type="email" {...register('email')} placeholder="jane@example.com" autoFocus error={errors.email} />
                </FormField>
                <button type="submit" className="btn-primary w-full" disabled={loading}>
                  {loading ? <Spinner size={15} /> : 'Send reset link'}
                </button>
              </form>
              <Link to="/login" className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-900 mt-4 justify-center">
                <ArrowLeft size={14} /> Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
