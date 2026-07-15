import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { loginUser } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import type { User } from '../../context/AuthContext';

export const Login: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const isRegistered = (location.state as any)?.registered;

  const onSubmit = async (data: any) => {
    setLoading(true);
    setApiError(null);
    try {
      const response = await loginUser({
        email: data.email,
        password: data.password,
      });

      const { access_token, refresh_token, user } = response;
      const transformedUser: User = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company?.name || '',
        companyId: user.company?.id || '',
        status: user.status,
        lastLogin: user.last_login,
        createdAt: user.created_at,
      };
      login(access_token, refresh_token, transformedUser);

      navigate('/dashboard');
    } catch (err: any) {
      setApiError(err.response?.data?.error || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Welcome Back</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sign in to access your dashboard</p>
      </div>

      {isRegistered && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-sm font-semibold">
          Registration successful! Please log in with your credentials.
        </div>
      )}

      {apiError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-300 text-sm font-medium">
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Email Address</label>
          <input
            type="email"
            placeholder="name@company.com"
            {...register('email', { 
              required: 'Email address is required',
              pattern: { value: /^\S+@\S+$/i, message: 'Invalid email format' }
            })}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all duration-150"
          />
          {errors.email && (
            <p className="text-red-500 dark:text-red-400 text-xs mt-1 font-medium">{errors.email.message as string}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            {...register('password', { required: 'Password is required' })}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all duration-150"
          />
          {errors.password && (
            <p className="text-red-500 dark:text-red-400 text-xs mt-1 font-medium">{errors.password.message as string}</p>
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-indigo-650 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors shadow-md shadow-indigo-600/10"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                VERIFYING...
              </span>
            ) : (
              'SIGN IN TO RETAILPULSE'
            )}
          </button>
        </div>
      </form>

      <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400 flex justify-between px-1">
        <Link to="/forgot-password" className="text-slate-500 dark:text-slate-450 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium">
          Forgot Password?
        </Link>
        <div>
          New company?{' '}
          <Link to="/register" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold transition-colors">
            Register Here
          </Link>
        </div>
      </div>
    </div>
  );
};
export default Login;
