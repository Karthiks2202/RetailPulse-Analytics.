import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const Register: React.FC = () => {
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const navigate = useNavigate();

  const password = watch('password');

  const onSubmit = async (data: any) => {
    setLoading(true);
    setApiError(null);
    try {
      await axios.post(`${API_URL}/auth/register`, {
        companyName: data.companyName,
        industry: data.industry,
        companyEmail: data.companyEmail,
        companyAddress: data.companyAddress,
        companyPhone: data.companyPhone,
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });

      // Redirect to login page on success
      navigate('/login', { state: { registered: true } });
    } catch (err: any) {
      setApiError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-100">Create your Organization</h2>
        <p className="text-sm text-slate-450 mt-1">Get started by registering your company and primary admin account</p>
      </div>

      {apiError && (
        <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-900/30 text-red-200 text-sm">
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Company Profile */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 border-b border-slate-800 pb-1">
            Company Profile
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Company Name *</label>
              <input
                type="text"
                placeholder="e.g. Acme Retailers Ltd."
                {...register('companyName', { required: 'Company name is required' })}
                className="w-full bg-slate-900/50 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all"
              />
              {errors.companyName && (
                <p className="text-red-400 text-xs mt-1">{errors.companyName.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Industry *</label>
              <select
                {...register('industry', { required: 'Please select an industry' })}
                className="w-full bg-slate-900/50 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none transition-all cursor-pointer"
              >
                <option value="" disabled className="text-slate-650">Select Industry...</option>
                <option value="Retail" className="bg-slate-900">Retail / Departmental</option>
                <option value="Supermarket" className="bg-slate-900">Supermarket / Grocery</option>
                <option value="Electronics" className="bg-slate-900">Electronics Store</option>
                <option value="Fashion" className="bg-slate-900">Fashion / Apparel</option>
                <option value="Pharmacy" className="bg-slate-900">Pharmacy / Medical</option>
                <option value="Other" className="bg-slate-900">Other Industry</option>
              </select>
              {errors.industry && (
                <p className="text-red-400 text-xs mt-1">{errors.industry.message as string}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Company Email Address *</label>
              <input
                type="email"
                placeholder="billing@acme.com"
                {...register('companyEmail', { 
                  required: 'Company email is required',
                  pattern: { value: /^\S+@\S+$/i, message: 'Invalid email address' }
                })}
                className="w-full bg-slate-900/50 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all"
              />
              {errors.companyEmail && (
                <p className="text-red-400 text-xs mt-1">{errors.companyEmail.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Company Address *</label>
              <input
                type="text"
                placeholder="123 Retail Lane, Hub City"
                {...register('companyAddress', { required: 'Company address is required' })}
                className="w-full bg-slate-900/50 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all"
              />
              {errors.companyAddress && (
                <p className="text-red-400 text-xs mt-1">{errors.companyAddress.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone Number *</label>
              <input
                type="tel"
                placeholder="+1 (555) 123-4567"
                {...register('companyPhone', { required: 'Company phone is required' })}
                className="w-full bg-slate-900/50 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all"
              />
              {errors.companyPhone && (
                <p className="text-red-400 text-xs mt-1">{errors.companyPhone.message as string}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Owner/Admin Settings */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 border-b border-slate-800 pb-1">
            Administrator Credentials
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name *</label>
              <input
                type="text"
                placeholder="Jane Doe"
                {...register('ownerName', { required: 'Name is required' })}
                className="w-full bg-slate-900/50 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all"
              />
              {errors.ownerName && (
                <p className="text-red-400 text-xs mt-1">{errors.ownerName.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Admin Email Address *</label>
              <input
                type="email"
                placeholder="jane.doe@acme.com"
                {...register('ownerEmail', { 
                  required: 'Admin email is required',
                  pattern: { value: /^\S+@\S+$/i, message: 'Invalid email address' }
                })}
                className="w-full bg-slate-900/50 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all"
              />
              {errors.ownerEmail && (
                <p className="text-red-400 text-xs mt-1">{errors.ownerEmail.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password *</label>
              <input
                type="password"
                placeholder="Min 8 characters"
                {...register('password', { 
                  required: 'Password is required', 
                  minLength: { value: 8, message: 'Password must be at least 8 characters' }
                })}
                className="w-full bg-slate-900/50 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all"
              />
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password *</label>
              <input
                type="password"
                placeholder="Confirm password"
                {...register('confirmPassword', { 
                  required: 'Please confirm password',
                  validate: (val) => val === password || 'Passwords do not match'
                })}
                className="w-full bg-slate-900/50 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all"
              />
              {errors.confirmPassword && (
                <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message as string}</p>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-indigo-650 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/20"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ONBOARDING ORGANIZATION...
              </span>
            ) : (
              'COMPLETE COMPANY ONBOARDING'
            )}
          </button>
        </div>
      </form>

      <div className="mt-6 text-center text-xs text-slate-450">
        Already registered?{' '}
        <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
          Sign In
        </Link>
      </div>
    </div>
  );
};
export default Register;
