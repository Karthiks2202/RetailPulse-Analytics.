import React from 'react';
import { Link } from 'react-router-dom';

export const Unauthorized: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <h1 className="text-5xl font-extrabold text-red-500 tracking-wider mb-2">403</h1>
      <h2 className="text-xl font-bold text-slate-100 mb-3">Access Forbidden</h2>
      <p className="text-sm text-slate-400 mb-6 max-w-md">
        You do not have sufficient privileges to access this dashboard module. Please contact your administrator.
      </p>
      <Link 
        to="/dashboard" 
        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg uppercase tracking-wide transition-all shadow-md shadow-indigo-600/10"
      >
        Return to Dashboard
      </Link>
    </div>
  );
};
export default Unauthorized;
