import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Assessment as AssessmentIcon, 
  People as PeopleIcon, 
  Inventory as InventoryIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Dashboard Overview</h1>
        <p className="text-sm text-slate-400 mt-1">Welcome back to the RetailPulse telemetry center.</p>
      </div>

      {/* Analytics widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { title: 'Gross Revenue', value: '$45,210.50', icon: <TimelineIcon className="text-indigo-450" />, desc: '+15.4% vs last month' },
          { title: 'Products Listed', value: '1,894', icon: <InventoryIcon className="text-indigo-450" />, desc: '4 active categories' },
          { title: 'Team Accounts', value: '8', icon: <PeopleIcon className="text-indigo-450" />, desc: '3 roles registered' },
          { title: 'Service Status', value: '100% Up', icon: <AssessmentIcon className="text-indigo-450" />, desc: 'All channels operational' }
        ].map((item, idx) => (
          <div key={idx} className="glass-card rounded-xl p-5 hover:border-slate-700/50 transition-all cursor-pointer">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.title}</span>
              <div className="h-8 w-8 rounded-lg bg-slate-900/60 flex items-center justify-center border border-slate-800/40">
                {item.icon}
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-100 mb-1">{item.value}</div>
            <span className="text-[10px] font-semibold text-emerald-400">{item.desc}</span>
          </div>
        ))}
      </div>

      {/* Chart container mockup */}
      <div className="glass-card rounded-xl p-6 border border-slate-850">
        <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4">Operations Metrics</h2>
        <div className="border border-dashed border-slate-800 rounded-lg h-60 flex flex-col items-center justify-center text-slate-500 text-sm">
          <p className="font-semibold text-slate-400">Interactive Analytics Graphs Coming Soon</p>
          <p className="text-xs text-slate-500 mt-1">Tenant association: <span className="text-indigo-450 font-mono font-bold">{user?.company}</span></p>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
