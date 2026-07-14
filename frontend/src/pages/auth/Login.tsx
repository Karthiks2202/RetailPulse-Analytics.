import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

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
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: data.email,
        password: data.password,
      });

      const { accessToken, refreshToken, user } = response.data;
      login(accessToken, refreshToken, user);
      
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
        <h2 className="text-2xl font-bold text-slate-100">Welcome Back</h2>
        <p className="text-sm text-slate-450 mt-1">Sign in to access your dashboard</p>
      </div>

      {isRegistered && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-900/30 text-emerald-300 text-sm font-semibold">
          Registration successful! Please log in with your credentials.
        </div>
      )}

      {apiError && (
        <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-900/30 text-red-200 text-sm">
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
          <input
            type="email"
            placeholder="name@company.com"
            {...register('email', { 
              required: 'Email address is required',
              pattern: { value: /^\S+@\S+$/i, message: 'Invalid email format' }
            })}
            className="w-full bg-slate-900/50 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all"
          />
          {errors.email && (
            <p className="text-red-400 text-xs mt-1">{errors.email.message as string}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            {...register('password', { required: 'Password is required' })}
            className="w-full bg-slate-900/50 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all"
          />
          {errors.password && (
            <p className="text-red-400 text-xs mt-1">{errors.password.message as string}</p>
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-indigo-650 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/20"
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

      <div className="mt-6 text-center text-xs text-slate-450 flex justify-between px-1">
        <Link to="/forgot-password" className="text-slate-500 hover:text-slate-450 transition-colors">
          Forgot Password?
        </Link>
        <div>
          New company?{' '}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
            Register Here
          </Link>
        </div>
      </div>
    </div>
  );
};
export default Login;
