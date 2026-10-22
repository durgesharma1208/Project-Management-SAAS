import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Eye, EyeOff, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { FormField, Input } from '../../components/ui/Form';
import { Alert, extractError } from '../../components/ui/Alert';
import { Spinner } from '../../components/ui/Spinner';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const RegisterPage = () => {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    setApiError(null);
    setLoading(true);
    try {
      await registerUser(data);
      navigate('/dashboard');
    } catch (e) {
      setApiError(extractError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-primary-50/30 to-surface-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-elevated">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-surface-900">TaskFlow</span>
        </div>

        <div className="card p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-surface-900">Create an account</h1>
            <p className="text-surface-500 mt-1 text-sm">Start managing projects with your team</p>
          </div>

          <Alert type="error" message={apiError} />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </FormField>

            <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
              {loading ? <Spinner size={15} /> : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-surface-500 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
