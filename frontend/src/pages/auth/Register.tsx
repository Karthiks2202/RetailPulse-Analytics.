import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { registerCompany } from '../../api/authApi';

export const Register: React.FC = () => {
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const password = watch('password');

  const onSubmit = async (data: any) => {
    setLoading(true);
    setApiError(null);
    try {
      await registerCompany({
        company_name: data.companyName,
        industry: data.industry,
        company_email: data.companyEmail,
        company_address: data.companyAddress,
        company_phone: data.companyPhone,
        owner_name: data.ownerName,
        owner_email: data.ownerEmail,
        password: data.password,
        confirm_password: data.confirmPassword,
      });
      navigate('/login', { state: { registered: true } });
    } catch (err: any) {
      setApiError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* Shared input className */
  const inputCls =
    'w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all duration-150';

  const labelCls =
    'block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide';

  return (
    <div>
      {/* Heading */}
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Create your Organization</h2>
        <p className="text-sm text-indigo-500 dark:text-indigo-400 mt-1 flex items-center gap-1 font-medium">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
          </svg>
          Register your company &amp; admin account
        </p>
      </div>

      {/* Error banner */}
      {apiError && (
        <div className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400 text-sm font-medium flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* ── Section 1: Company Profile ── */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3 pb-1.5 border-b border-slate-200 dark:border-slate-700">
            Company Profile
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Company Name */}
            <div>
              <label className={labelCls}>Company Name *</label>
              <input
                id="reg-companyName"
                type="text"
                placeholder="e.g. Acme Retailers Ltd."
                {...register('companyName', { required: 'Company name is required' })}
                className={inputCls}
              />
              {errors.companyName && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.companyName.message as string}</p>
              )}
            </div>

            {/* Industry */}
            <div>
              <label className={labelCls}>Industry *</label>
              <select
                id="reg-industry"
                {...register('industry', { required: 'Please select an industry' })}
                className={inputCls + ' cursor-pointer'}
              >
                <option value="" disabled>Select Industry...</option>
                <option value="Retail">Retail / Departmental</option>
                <option value="Supermarket">Supermarket / Grocery</option>
                <option value="Electronics">Electronics Store</option>
                <option value="Fashion">Fashion / Apparel</option>
                <option value="Pharmacy">Pharmacy / Medical</option>
                <option value="Other">Other Industry</option>
              </select>
              {errors.industry && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.industry.message as string}</p>
              )}
            </div>

            {/* Company Email */}
            <div className="md:col-span-2">
              <label className={labelCls}>Company Email Address *</label>
              <input
                id="reg-companyEmail"
                type="email"
                placeholder="billing@acme.com"
                {...register('companyEmail', {
                  required: 'Company email is required',
                  pattern: { value: /^\S+@\S+$/i, message: 'Invalid email address' },
                })}
                className={inputCls}
              />
              {errors.companyEmail && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.companyEmail.message as string}</p>
              )}
            </div>

            {/* Company Address */}
            <div>
              <label className={labelCls}>Company Address *</label>
              <input
                id="reg-companyAddress"
                type="text"
                placeholder="123 Retail Lane, Hub City"
                {...register('companyAddress', { required: 'Company address is required' })}
                className={inputCls}
              />
              {errors.companyAddress && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.companyAddress.message as string}</p>
              )}
            </div>

            {/* Company Phone */}
            <div>
              <label className={labelCls}>Phone Number *</label>
              <input
                id="reg-companyPhone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                {...register('companyPhone', { required: 'Company phone is required' })}
                className={inputCls}
              />
              {errors.companyPhone && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.companyPhone.message as string}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 2: Administrator Credentials ── */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3 pb-1.5 border-b border-slate-200 dark:border-slate-700">
            Administrator Credentials
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Full Name */}
            <div>
              <label className={labelCls}>Full Name *</label>
              <input
                id="reg-ownerName"
                type="text"
                placeholder="Jane Doe"
                {...register('ownerName', { required: 'Name is required' })}
                className={inputCls}
              />
              {errors.ownerName && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.ownerName.message as string}</p>
              )}
            </div>

            {/* Admin Email */}
            <div>
              <label className={labelCls}>Admin Email *</label>
              <input
                id="reg-ownerEmail"
                type="email"
                placeholder="jane.doe@acme.com"
                {...register('ownerEmail', {
                  required: 'Admin email is required',
                  pattern: { value: /^\S+@\S+$/i, message: 'Invalid email address' },
                })}
                className={inputCls}
              />
              {errors.ownerEmail && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.ownerEmail.message as string}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className={labelCls}>Password *</label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Password must be at least 8 characters' },
                  })}
                  className={inputCls + ' pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.password.message as string}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className={labelCls}>Confirm Password *</label>
              <div className="relative">
                <input
                  id="reg-confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  {...register('confirmPassword', {
                    required: 'Please confirm password',
                    validate: (val) => val === password || 'Passwords do not match',
                  })}
                  className={inputCls + ' pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showConfirmPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.confirmPassword.message as string}</p>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-1">
          <button
            id="reg-submit"
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all duration-150 disabled:opacity-60 shadow-md"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Onboarding Organization...
              </span>
            ) : (
              'Complete Company Onboarding'
            )}
          </button>
        </div>
      </form>

      {/* Footer */}
      <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
        Already registered?{' '}
        <Link
          to="/login"
          className="text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          Sign In
        </Link>
      </p>
    </div>
  );
};
export default Register;
