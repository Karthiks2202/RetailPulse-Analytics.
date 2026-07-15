import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../api/axios';

export const Profile: React.FC = () => {
  const { user } = useAuth();
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const newPassword = watch('newPassword');

  const onSubmit = async (data: any) => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await axiosInstance.post('/profile/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });

      setSuccessMsg('Password updated successfully!');
      reset();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">My Profile</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium">Manage your identity and security settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile details */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 lg:col-span-2 space-y-6 shadow-sm">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Account Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Full Name</span>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{user?.name}</p>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Email Address</span>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{user?.email}</p>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Authorized Role</span>
              <div className="mt-1">
                <p className="text-[10px] inline-block bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-indigo-700 dark:text-indigo-400 font-mono font-bold px-2 py-0.5 rounded uppercase">
                  {user?.role}
                </p>
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Assigned Organization</span>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{user?.company}</p>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Last Authentication</span>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-350">{formatDate(user?.lastLogin || null)}</p>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Status</span>
              <div className="mt-1">
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-450 border border-emerald-200 dark:border-emerald-900/30 font-bold capitalize">
                  {user?.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6 shadow-sm">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Security Settings</h2>
          </div>

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-xs font-semibold">
              {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-350 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Current Password</label>
              <input
                type="password"
                placeholder="Enter current password"
                {...register('currentPassword', { required: 'Current password is required' })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-650 outline-none transition-all duration-150"
              />
              {errors.currentPassword && (
                <p className="text-red-500 dark:text-red-400 text-[10px] mt-1 font-semibold">{errors.currentPassword.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1.5">New Password</label>
              <input
                type="password"
                placeholder="Min 8 characters"
                {...register('newPassword', { 
                  required: 'New password is required',
                  minLength: { value: 8, message: 'Password must be at least 8 characters' }
                })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-650 outline-none transition-all duration-150"
              />
              {errors.newPassword && (
                <p className="text-red-500 dark:text-red-400 text-[10px] mt-1 font-semibold">{errors.newPassword.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                placeholder="Re-enter new password"
                {...register('confirmNewPassword', { 
                  required: 'Please confirm new password',
                  validate: (val) => val === newPassword || 'Passwords do not match'
                })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-650 outline-none transition-all duration-150"
              />
              {errors.confirmNewPassword && (
                <p className="text-red-500 dark:text-red-400 text-[10px] mt-1 font-semibold">{errors.confirmNewPassword.message as string}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-850 text-white font-semibold text-xs tracking-wide transition-all shadow-md shadow-indigo-500/10"
            >
              {loading ? 'SAVING CHANGES...' : 'UPDATE PASSWORD'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
export default Profile;
