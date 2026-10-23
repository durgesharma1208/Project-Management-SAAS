import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, MailCheck } from 'lucide-react';
import api from '../../lib/api';
import { FormField, Input } from '../../components/ui/Form';
import { Alert, extractError } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';
import { AuthShell } from '../../components/layout/AuthShell';

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
    <AuthShell
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 text-surface-500 transition-colors hover:text-surface-900">
          <ArrowLeft size={13} /> Back to login
        </Link>
      }
    >
      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
            <MailCheck size={22} className="text-emerald-600" aria-hidden="true" />
          </div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-surface-900">Check your email</h1>
          <p className="mt-2 text-sm text-surface-500">
            If that email exists, we&apos;ve sent a reset link. Check the server console if email is not configured.
          </p>
          <Link to="/login" className="btn-primary mt-5 inline-flex">Back to login</Link>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-surface-900">Reset password</h1>
            <p className="mt-1 text-sm text-surface-500">Enter your email and we&apos;ll send a reset link</p>
          </div>

          <Alert type="error" message={apiError} />

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <FormField label="Email address" error={errors.email?.message} required id="email">
              <Input id="email" type="email" {...register('email')} placeholder="jane@example.com" autoFocus error={errors.email} />
            </FormField>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Spinner size={15} /> : 'Send reset link'}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
};

export default ForgotPasswordPage;
