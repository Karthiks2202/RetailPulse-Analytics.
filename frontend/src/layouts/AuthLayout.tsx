import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const AuthLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();

  // If already authenticated, redirect straight to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 overflow-hidden font-sans">
      {/* Decorative Orbs */}
      <div className="absolute top-1/4 left-1/4 h-[350px] w-[350px] rounded-full bg-indigo-600/15 blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-indigo-500/10 blur-[120px] animate-pulse delay-1000"></div>

      <div className="z-10 w-full max-w-xl px-4 py-8">
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/30">
            <span className="text-2xl font-bold text-white">R</span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-indigo-200 to-purple-400 bg-clip-text text-transparent">
            RetailPulse
          </h1>
          <p className="mt-1 text-sm text-slate-400">Multi-Tenant Retail Management & Analytics</p>
        </div>
        <div className="glass rounded-2xl p-6 md:p-8 shadow-2xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
export default AuthLayout;
