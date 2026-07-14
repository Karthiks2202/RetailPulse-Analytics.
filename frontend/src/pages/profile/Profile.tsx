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
        <h1 className="text-2xl font-extrabold text-slate-100">My Profile</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your identity and security settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile details */}
        <div className="glass-card rounded-xl p-6 lg:col-span-2 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Account Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Full Name</span>
              <p className="text-sm font-medium text-slate-100">{user?.name}</p>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Email Address</span>
              <p className="text-sm font-medium text-slate-100">{user?.email}</p>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Authorized Role</span>
              <p className="text-xs inline-block bg-slate-900 border border-slate-800 text-indigo-400 font-mono px-2 py-0.5 rounded uppercase mt-0.5">
                {user?.role}
              </p>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Assigned Organization</span>
              <p className="text-sm font-medium text-slate-100">{user?.company}</p>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Last Authentication</span>
              <p className="text-xs font-medium text-slate-350">{formatDate(user?.lastLogin || null)}</p>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-450 border border-emerald-900/50 font-bold capitalize">
                {user?.status}
              </span>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="glass-card rounded-xl p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Security Settings</h2>
          </div>

          {successMsg && (
            <div className="p-3 rounded bg-emerald-950/40 border border-emerald-900/30 text-emerald-350 text-xs font-semibold">
              {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded bg-red-950/40 border border-red-900/30 text-red-300 text-xs">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Current Password</label>
              <input
                type="password"
                placeholder="Enter current password"
                {...register('currentPassword', { required: 'Current password is required' })}
                className="w-full bg-slate-900/50 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all"
              />
              {errors.currentPassword && (
                <p className="text-red-400 text-[10px] mt-1">{errors.currentPassword.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">New Password</label>
              <input
                type="password"
                placeholder="Min 8 characters"
                {...register('newPassword', { 
                  required: 'New password is required',
                  minLength: { value: 8, message: 'Password must be at least 8 characters' }
                })}
                className="w-full bg-slate-900/50 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all"
              />
              {errors.newPassword && (
                <p className="text-red-400 text-[10px] mt-1">{errors.newPassword.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                placeholder="Re-enter new password"
                {...register('confirmNewPassword', { 
                  required: 'Please confirm new password',
                  validate: (val) => val === newPassword || 'Passwords do not match'
                })}
                className="w-full bg-slate-900/50 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all"
              />
              {errors.confirmNewPassword && (
                <p className="text-red-400 text-[10px] mt-1">{errors.confirmNewPassword.message as string}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-750 text-white font-semibold text-xs tracking-wide transition-all shadow-md shadow-indigo-600/10"
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
