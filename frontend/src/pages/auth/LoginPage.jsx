import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { FormField, Input } from '../../components/ui/Form';
import { Alert, extractError } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';
import { AuthShell } from '../../components/layout/AuthShell';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Deep links (e.g. an invitation) survive the sign-in / sign-up detour.
  const redirectTo = searchParams.get('redirect');
  const destination = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
    ? redirectTo
    : '/dashboard';
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    setApiError(null);
    setLoading(true);
    try {
      await login(data);
      navigate(destination, { replace: true });
    } catch (e) {
      setApiError(extractError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            to={redirectTo ? `/register?redirect=${encodeURIComponent(redirectTo)}` : '/register'}
            className="font-medium text-primary-600 hover:underline"
          >
            Sign up
          </Link>
        </>
      }
    >
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-surface-900">Welcome back</h1>
        <p className="mt-1 text-sm text-surface-500">Sign in to your account to continue</p>
      </div>

      <Alert type="error" message={apiError} />

      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
        <FormField label="Email address" error={errors.email?.message} required id="email">
          <Input id="email" type="email" {...register('email')} placeholder="jane@example.com" autoFocus error={errors.email} />
        </FormField>

        <FormField label="Password" error={errors.password?.message} required id="password">
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              placeholder="Your password"
              error={errors.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 transition-colors hover:text-surface-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </FormField>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs text-primary-600 hover:underline">
            Forgot password?
          </Link>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? <Spinner size={15} /> : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
};

export default LoginPage;
