import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Dashboard as DashIcon, 
  Person as ProfileIcon, 
  ExitToApp as LogoutIcon,
  Business as CompanyIcon,
  WbSunny as SunIcon,
  NightsStay as MoonIcon
} from '@mui/icons-material';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-colors duration-300">
        <div>
          {/* Logo Header */}
          <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 shadow shadow-indigo-500/20 text-white font-extrabold text-sm tracking-wider">
                R
              </div>
              <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                RetailPulse
              </span>
            </div>
          </div>
          {/* Navigation Links */}
          <nav className="mt-6 px-4 space-y-1.5">
            <Link
              to="/dashboard"
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
                isActive('/dashboard') 
                  ? 'bg-indigo-50 dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-sm dark:shadow-md border border-slate-200 dark:border-indigo-650' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-transparent'
              }`}
            >
              <DashIcon fontSize="small" />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/profile"
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
                isActive('/profile') 
                  ? 'bg-indigo-50 dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-sm dark:shadow-md border border-slate-200 dark:border-indigo-650' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-transparent'
              }`}
            >
              <ProfileIcon fontSize="small" />
              <span>My Profile</span>
            </Link>
          </nav>
        </div>

        {/* Sidebar Footer Account telemetry */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white uppercase shadow-inner">
              {user?.name ? user.name.charAt(0) : '?'}
            </div>
            <div className="truncate">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono uppercase tracking-wider font-semibold">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-200 border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-900/30 text-slate-600 dark:text-slate-300 text-xs font-bold tracking-wide transition-all duration-150 shadow-sm"
          >
            <LogoutIcon style={{ fontSize: 16 }} />
            <span>SIGN OUT</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main Header bar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 transition-colors duration-300">
          <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-450">
            <CompanyIcon fontSize="small" className="text-indigo-600 dark:text-indigo-400" />
            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
              {user?.company}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-mono tracking-tight font-semibold">
              ID: {user?.companyId}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* Account Status */}
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className="text-slate-500 dark:text-slate-400">Status:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 font-bold capitalize tracking-wide">
                {user?.status}
              </span>
            </div>

            {/* Divider */}
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700"></div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 transition-all duration-150 bg-white dark:bg-slate-900 shadow-sm"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? (
                <SunIcon style={{ fontSize: 18 }} className="text-amber-500" />
              ) : (
                <MoonIcon style={{ fontSize: 18 }} className="text-indigo-600" />
              )}
            </button>
          </div>
        </header>

        {/* Inner container */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-8 transition-colors duration-300">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
export default DashboardLayout;
