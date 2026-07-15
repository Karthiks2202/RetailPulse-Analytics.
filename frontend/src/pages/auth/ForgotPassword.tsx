import React from 'react';
import { Link } from 'react-router-dom';

export const ForgotPassword: React.FC = () => {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2.5">Reset Password</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-sm mx-auto leading-relaxed">
        Please contact your system administrator or <a href="mailto:support@retailpulse.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">support@retailpulse.com</a> to trigger a manual account password reset.
      </p>
      <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-bold transition-colors">
        Return to Login
      </Link>
    </div>
  );
};
export default ForgotPassword;
