import React from 'react';
import { Link } from 'react-router-dom';

export const ForgotPassword: React.FC = () => {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold text-slate-100 mb-2">Reset Password</h2>
      <p className="text-sm text-slate-400 mb-6">
        Please contact your system administrator or support@retailpulse.com to trigger a manual account password reset.
      </p>
      <Link to="/login" className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold transition-colors">
        Return to Login
      </Link>
    </div>
  );
};
export default ForgotPassword;
