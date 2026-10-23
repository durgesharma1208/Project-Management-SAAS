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
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const RegisterPage = () => {
  const { register: registerUser } = useAuth();
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
      await registerUser(data);
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
          Already have an account?{' '}
          <Link
            to={redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'}
            className="font-medium text-primary-600 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-surface-900">Create an account</h1>
        <p className="mt-1 text-sm text-surface-500">Start managing projects with your team</p>
      </div>

      <Alert type="error" message={apiError} />

      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
        <FormField label="Full name" error={errors.name?.message} required id="name">
          <Input id="name" {...register('name')} placeholder="Jane Smith" autoFocus error={errors.name} />
        </FormField>

        <FormField label="Email address" error={errors.email?.message} required id="email">
          <Input id="email" type="email" {...register('email')} placeholder="jane@example.com" error={errors.email} />
        </FormField>

        <FormField label="Password" error={errors.password?.message} required id="password">
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              placeholder="Min. 8 characters"
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

        <button type="submit" className="btn-primary mt-2 w-full" disabled={loading}>
          {loading ? <Spinner size={15} /> : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
};

export default RegisterPage;
