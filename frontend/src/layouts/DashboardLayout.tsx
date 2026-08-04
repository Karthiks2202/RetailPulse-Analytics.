import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Dashboard as DashIcon,
  Person as ProfileIcon,
  ExitToApp as LogoutIcon,
  Business as CompanyIcon,
  WbSunny as SunIcon,
  NightsStay as MoonIcon,
  Category as CategoryIcon,
  ShowChart as ShowChartIcon,
  Inventory as InventoryIcon,
  Receipt as ReceiptIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Analytics as AnalyticsIcon,
  Refresh as RefreshIcon,
  People as PeopleIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { NotificationBell } from './NotificationBell';
import { useQueryClient } from '@tanstack/react-query';
import { refreshAnalytics } from '../api/analyticsApi';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', Icon: DashIcon, adminOnly: false },
  { to: '/profile',   label: 'My Profile', Icon: ProfileIcon, adminOnly: false },
  { to: '/analytics', label: 'Analytics', Icon: AnalyticsIcon, adminOnly: true },
  { to: '/forecast',  label: 'Forecast', Icon: TimelineIcon, adminOnly: true },
  { to: '/products',  label: 'Products',   Icon: InventoryIcon, adminOnly: true },
  { to: '/inventory', label: 'Inventory',  Icon: ShowChartIcon, adminOnly: true },
  { to: '/categories',label: 'Categories', Icon: CategoryIcon, adminOnly: true },
  { to: '/customers', label: 'Customers',  Icon: PeopleIcon, adminOnly: true },
  { to: '/sales',     label: 'Sales',      Icon: ReceiptIcon, adminOnly: true },
];

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAnalytics();
      await queryClient.invalidateQueries();
    } catch {
      queryClient.invalidateQueries();
    }
    setRefreshing(false);
  };

  const isActive = (path: string) => location.pathname === path;
  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';
  const isAnalyst = user?.role === 'ANALYST';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 shadow-lg shadow-indigo-900/40">
            <svg viewBox="0 0 32 32" fill="none" className="h-5 w-5">
              <circle cx="16" cy="16" r="10" stroke="white" strokeWidth="2.5" fill="none" strokeDasharray="20 42"/>
              <path d="M16 6 A10 10 0 0 1 26 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <circle cx="16" cy="16" r="3.5" fill="white"/>
            </svg>
          </div>
          <span className="text-base font-extrabold tracking-tight text-white">RetailPulse</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-white/10 mb-4"/>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, Icon, adminOnly }) => {
          if (adminOnly && !isAdmin && !isAnalyst) return null;
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                active
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-900/30'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon
                fontSize="small"
                className={active ? 'text-white' : 'text-slate-500 group-hover:text-indigo-300 transition-colors'}
              />
              <span>{label}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/70"/>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User profile + logout */}
      <div className="p-4 shrink-0 space-y-3">
        <div className="mx-1 border-t border-white/10 mb-3"/>
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-sm font-bold text-white uppercase shadow-md shrink-0">
            {user?.name ? user.name.charAt(0) : '?'}
          </div>
          <div className="truncate flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-indigo-300 truncate font-semibold uppercase tracking-wider">
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-300 border border-white/10 hover:border-red-500/30 text-slate-400 text-xs font-bold tracking-wide transition-all duration-150"
        >
          <LogoutIcon style={{ fontSize: 15 }} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300 overflow-hidden">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside
        className="hidden md:flex w-60 flex-col shrink-0 transition-colors duration-300"
        style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 60%, #1a1042 100%)' }}
      >
        <SidebarContent />
      </aside>

      {/* ── MOBILE SIDEBAR OVERLAY ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside
            className="relative z-50 w-64 flex flex-col h-full shadow-2xl"
            style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 60%, #1a1042 100%)' }}
          >
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <CloseIcon fontSize="small"/>
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <header className="h-14 md:h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 gap-4 shrink-0 transition-colors duration-300 z-30">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger (mobile) */}
            <button
              className="md:hidden p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <MenuIcon style={{ fontSize: 20 }}/>
            </button>

            {/* Company info */}
            <div className="flex items-center gap-2 min-w-0">
              <CompanyIcon fontSize="small" className="text-indigo-500 shrink-0"/>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">
                {user?.company}
              </span>
              <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-500 dark:text-indigo-400 font-mono tracking-tight font-semibold truncate max-w-[120px]">
                {user?.companyId?.slice(0, 8)}…
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {/* Status badge */}
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"/>
              {user?.status}
            </span>

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"/>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 transition-all bg-white dark:bg-slate-900 shadow-sm disabled:opacity-60"
              title="Refresh dashboard"
            >
              <RefreshIcon style={{ fontSize: 17 }} className={refreshing ? 'animate-spin' : ''} />
            </button>

            <NotificationBell />

            {/* Theme toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 transition-all bg-white dark:bg-slate-900 shadow-sm"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode
                ? <SunIcon style={{ fontSize: 17 }} className="text-amber-400"/>
                : <MoonIcon style={{ fontSize: 17 }} className="text-indigo-500"/>
              }
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 md:p-6 lg:p-8 transition-colors duration-300">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
export default DashboardLayout;
