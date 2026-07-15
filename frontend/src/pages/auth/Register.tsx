import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { registerCompany } from '../../api/authApi';

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
      await registerCompany({
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
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Create your Organization</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Get started by registering your company and primary admin account</p>
      </div>

      {apiError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-300 text-sm font-medium">
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Company Profile */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3 border-b border-slate-200 dark:border-slate-800 pb-1.5">
            Company Profile
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Company Name *</label>
              <input
                type="text"
                placeholder="e.g. Acme Retailers Ltd."
                {...register('companyName', { required: 'Company name is required' })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all duration-150"
              />
              {errors.companyName && (
                <p className="text-red-500 dark:text-red-400 text-xs mt-1 font-medium">{errors.companyName.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Industry *</label>
              <select
                {...register('industry', { required: 'Please select an industry' })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none transition-all duration-150 cursor-pointer"
              >
                <option value="" disabled className="text-slate-500 dark:text-slate-400">Select Industry...</option>
                <option value="Retail" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Retail / Departmental</option>
                <option value="Supermarket" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Supermarket / Grocery</option>
                <option value="Electronics" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Electronics Store</option>
                <option value="Fashion" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Fashion / Apparel</option>
                <option value="Pharmacy" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Pharmacy / Medical</option>
                <option value="Other" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Other Industry</option>
              </select>
              {errors.industry && (
                <p className="text-red-500 dark:text-red-400 text-xs mt-1 font-medium">{errors.industry.message as string}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Company Email Address *</label>
              <input
                type="email"
                placeholder="billing@acme.com"
                {...register('companyEmail', { 
                  required: 'Company email is required',
                  pattern: { value: /^\S+@\S+$/i, message: 'Invalid email address' }
                })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all duration-150"
              />
              {errors.companyEmail && (
                <p className="text-red-500 dark:text-red-400 text-xs mt-1 font-medium">{errors.companyEmail.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Company Address *</label>
              <input
                type="text"
                placeholder="123 Retail Lane, Hub City"
                {...register('companyAddress', { required: 'Company address is required' })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all duration-150"
              />
              {errors.companyAddress && (
                <p className="text-red-500 dark:text-red-400 text-xs mt-1 font-medium">{errors.companyAddress.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Phone Number *</label>
              <input
                type="tel"
                placeholder="+1 (555) 123-4567"
                {...register('companyPhone', { required: 'Company phone is required' })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all duration-150"
              />
              {errors.companyPhone && (
                <p className="text-red-500 dark:text-red-400 text-xs mt-1 font-medium">{errors.companyPhone.message as string}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Owner/Admin Settings */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3 border-b border-slate-200 dark:border-slate-800 pb-1.5">
            Administrator Credentials
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Full Name *</label>
              <input
                type="text"
                placeholder="Jane Doe"
                {...register('ownerName', { required: 'Name is required' })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all duration-150"
              />
              {errors.ownerName && (
                <p className="text-red-500 dark:text-red-400 text-xs mt-1 font-medium">{errors.ownerName.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Admin Email Address *</label>
              <input
                type="email"
                placeholder="jane.doe@acme.com"
                {...register('ownerEmail', { 
                  required: 'Admin email is required',
                  pattern: { value: /^\S+@\S+$/i, message: 'Invalid email address' }
                })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all duration-150"
              />
              {errors.ownerEmail && (
                <p className="text-red-500 dark:text-red-400 text-xs mt-1 font-medium">{errors.ownerEmail.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Password *</label>
              <input
                type="password"
                placeholder="Min 8 characters"
                {...register('password', { 
                  required: 'Password is required', 
                  minLength: { value: 8, message: 'Password must be at least 8 characters' }
                })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all duration-150"
              />
              {errors.password && (
                <p className="text-red-500 dark:text-red-400 text-xs mt-1 font-medium">{errors.password.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Confirm Password *</label>
              <input
                type="password"
                placeholder="Confirm password"
                {...register('confirmPassword', { 
                  required: 'Please confirm password',
                  validate: (val) => val === password || 'Passwords do not match'
                })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all duration-150"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 dark:text-red-400 text-xs mt-1 font-medium">{errors.confirmPassword.message as string}</p>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors shadow-md shadow-indigo-500/10"
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

      <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
        Already registered?{' '}
        <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold transition-colors">
          Sign In
        </Link>
      </div>
    </div>
  );
};
export default Register;
