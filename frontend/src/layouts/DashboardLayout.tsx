import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Dashboard as DashIcon, 
  Person as ProfileIcon, 
  ExitToApp as LogoutIcon,
  Business as CompanyIcon
} from '@mui/icons-material';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-850 flex flex-col justify-between">
        <div>
          {/* Logo Header */}
          <div className="h-16 flex items-center px-6 border-b border-slate-850">
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              RetailPulse
            </span>
          </div>
          {/* Navigation Links */}
          <nav className="mt-6 px-4 space-y-1">
            <Link
              to="/dashboard"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive('/dashboard') 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <DashIcon fontSize="small" />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/profile"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive('/profile') 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ProfileIcon fontSize="small" />
              <span>My Profile</span>
            </Link>
          </nav>
        </div>

        {/* Sidebar Footer Account telemetry */}
        <div className="p-4 border-t border-slate-850 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white uppercase shadow-inner">
              {user?.name ? user.name.charAt(0) : '?'}
            </div>
            <div className="truncate">
              <p className="text-sm font-semibold text-slate-100 truncate">{user?.name}</p>
              <p className="text-xs text-slate-450 truncate font-mono uppercase tracking-wider">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-red-950/40 hover:text-red-200 border border-slate-750 hover:border-red-900/30 text-slate-300 text-xs font-semibold tracking-wide transition-all duration-150"
          >
            <LogoutIcon style={{ fontSize: 16 }} />
            <span>SIGN OUT</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main Header bar */}
        <header className="h-16 bg-slate-900 border-b border-slate-855 flex items-center justify-between px-8">
          <div className="flex items-center gap-2.5 text-slate-300">
            <CompanyIcon fontSize="small" className="text-indigo-400" />
            <span className="font-bold text-slate-100 text-sm">
              {user?.company}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono tracking-tighter">
              ID: {user?.companyId}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Account status:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/50 text-emerald-450 border border-emerald-900/35 font-semibold capitalize tracking-wide">
              {user?.status}
            </span>
          </div>
        </header>

        {/* Inner container */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-6 md:p-8">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
export default DashboardLayout;
