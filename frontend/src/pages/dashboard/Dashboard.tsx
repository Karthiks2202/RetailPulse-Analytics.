import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Assessment as AssessmentIcon, 
  People as PeopleIcon, 
  Inventory as InventoryIcon,
  Timeline as TimelineIcon,
  ArrowUpward as ArrowUpIcon,
  TrendingUp as TrendingIcon,
  Storefront as StoreIcon
} from '@mui/icons-material';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeChartTab, setActiveChartTab] = useState<'revenue' | 'channels'>('revenue');

  const metricCards = [
    { 
      title: 'Gross Revenue', 
      value: '$45,210.50', 
      icon: <TimelineIcon className="text-indigo-600 dark:text-indigo-400" />, 
      desc: '+15.4% vs last month',
      color: 'text-indigo-600' 
    },
    { 
      title: 'Products Listed', 
      value: '1,894', 
      icon: <InventoryIcon className="text-emerald-600 dark:text-emerald-400" />, 
      desc: '+3.2% active list',
      color: 'text-emerald-600'
    },
    { 
      title: 'Team Accounts', 
      value: '8 Members', 
      icon: <PeopleIcon className="text-sky-600 dark:text-sky-400" />, 
      desc: '3 roles authorized',
      color: 'text-sky-600'
    },
    { 
      title: 'Service Status', 
      value: '100% Up', 
      icon: <AssessmentIcon className="text-amber-600 dark:text-amber-400" />, 
      desc: 'All channels operational',
      color: 'text-amber-600'
    }
  ];

  const channelBreakdown = [
    { name: 'Departmental POS', percentage: 64, value: '$28,934.72', color: 'bg-indigo-600' },
    { name: 'Online Storefront', percentage: 24, value: '$10,850.52', color: 'bg-emerald-500' },
    { name: 'Express Kiosks', percentage: 12, value: '$5,425.26', color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Dashboard Overview</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
          Welcome back to the RetailPulse management desk. Here is your enterprise telemetry.
        </p>
      </div>

      {/* Analytics widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {metricCards.map((item, idx) => (
          <div 
            key={idx} 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{item.title}</span>
              <div className="h-9 w-9 rounded-lg bg-slate-50 dark:bg-slate-950 flex items-center justify-center border border-slate-100 dark:border-slate-800 group-hover:border-indigo-200 dark:group-hover:border-indigo-900/50 transition-colors duration-150">
                {item.icon}
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1.5 tracking-tight">{item.value}</div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/20 flex items-center gap-0.5">
                <ArrowUpIcon style={{ fontSize: 10 }} />
                {item.desc}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Operations Metrics Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
        {/* Header Tabs */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/30">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <TrendingIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
              Operations Metrics
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-450 mt-0.5">Tenant: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{user?.company}</span> (ID: {user?.companyId})</p>
          </div>
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveChartTab('revenue')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activeChartTab === 'revenue' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Revenue Timeline
            </button>
            <button
              onClick={() => setActiveChartTab('channels')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                activeChartTab === 'channels' 
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sales Channels
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {activeChartTab === 'revenue' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* SVG Line Chart */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-450 font-medium">
                  <span>Monthly Revenue Trend (USD)</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-650"></span> This Year</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700"></span> Projections</span>
                  </div>
                </div>

                <div className="relative h-60 w-full bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-150 dark:border-slate-800/60 p-4">
                  <svg viewBox="0 0 600 200" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.16" />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid Lines */}
                    <line x1="40" y1="20" x2="580" y2="20" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" strokeDasharray="3 3" />
                    <line x1="40" y1="70" x2="580" y2="70" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" strokeDasharray="3 3" />
                    <line x1="40" y1="120" x2="580" y2="120" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" strokeDasharray="3 3" />
                    <line x1="40" y1="170" x2="580" y2="170" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" />

                    {/* Y-Axis Labels */}
                    <text x="15" y="24" className="text-[10px] font-bold fill-slate-400 font-mono">50k</text>
                    <text x="15" y="74" className="text-[10px] font-bold fill-slate-400 font-mono">30k</text>
                    <text x="15" y="124" className="text-[10px] font-bold fill-slate-400 font-mono">10k</text>
                    <text x="15" y="174" className="text-[10px] font-bold fill-slate-400 font-mono">0</text>

                    {/* X-Axis Labels */}
                    <text x="40" y="192" className="text-[10px] font-bold fill-slate-400 dark:fill-slate-500 text-center">Jan</text>
                    <text x="148" y="192" className="text-[10px] font-bold fill-slate-400 dark:fill-slate-500">Feb</text>
                    <text x="256" y="192" className="text-[10px] font-bold fill-slate-400 dark:fill-slate-500">Mar</text>
                    <text x="364" y="192" className="text-[10px] font-bold fill-slate-400 dark:fill-slate-500">Apr</text>
                    <text x="472" y="192" className="text-[10px] font-bold fill-slate-400 dark:fill-slate-500">May</text>
                    <text x="565" y="192" className="text-[10px] font-bold fill-slate-400 dark:fill-slate-500">Jun</text>

                    {/* Area fill under curve */}
                    <path
                      d="M 40,170 Q 148,150 256,90 T 472,60 L 580,25 L 580,170 Z"
                      fill="url(#chart-gradient)"
                    />

                    {/* SVG Line path */}
                    <path
                      d="M 40,170 Q 148,150 256,90 T 472,60 L 580,25"
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />

                    {/* SVG Projections line */}
                    <line x1="580" y1="25" x2="600" y2="15" stroke="#a5b4fc" strokeWidth="2.5" strokeDasharray="4 4" />

                    {/* Data Points */}
                    <circle cx="40" cy="170" r="4.5" className="fill-indigo-600 stroke-white dark:stroke-slate-900" strokeWidth="2" />
                    <circle cx="148" cy="150" r="4.5" className="fill-indigo-600 stroke-white dark:stroke-slate-900" strokeWidth="2" />
                    <circle cx="256" cy="90" r="4.5" className="fill-indigo-600 stroke-white dark:stroke-slate-900" strokeWidth="2" />
                    <circle cx="472" cy="60" r="4.5" className="fill-indigo-600 stroke-white dark:stroke-slate-900" strokeWidth="2" />
                    
                    {/* Tooltip detail at peak */}
                    <g transform="translate(472, 60)">
                      <circle r="8" className="fill-indigo-500/30 animate-ping" />
                      <circle r="5" className="fill-indigo-600 stroke-white dark:stroke-slate-900" strokeWidth="2" />
                    </g>
                    <text x="450" y="42" className="text-[10px] font-extrabold fill-slate-800 dark:fill-white font-mono bg-white">$45.2k</text>
                  </svg>
                </div>
              </div>

              {/* Side Info Cards */}
              <div className="flex flex-col justify-between space-y-4">
                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-5 border border-slate-150 dark:border-slate-800/80 space-y-3.5">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Performance Index</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">92.4%</span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-450 font-bold">+4.1% MoM</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    Your outlet transaction response rates and listing updates are well within standard enterprise SLAs.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-5 border border-slate-150 dark:border-slate-800/80 space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <StoreIcon fontSize="inherit" className="text-indigo-500" />
                    Quick Actions
                  </h3>
                  <div className="space-y-2">
                    <button className="w-full text-left text-xs font-semibold py-2 px-3 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-350 transition-all shadow-sm">
                      Generate Transaction Audit
                    </button>
                    <button className="w-full text-left text-xs font-semibold py-2 px-3 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-350 transition-all shadow-sm">
                      Sync Register Telemetry
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-450 font-medium">
                <span>Distribution by Sales Channels</span>
                <span>Fiscal Quarter 3</span>
              </div>

              {/* Progress Bars for Channels */}
              <div className="space-y-5">
                {channelBreakdown.map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-sm font-semibold text-slate-700 dark:text-slate-300">
                      <span>{item.name}</span>
                      <span className="font-mono">{item.value} ({item.percentage}%)</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-850">
                      <div 
                        className={`h-full ${item.color} rounded-full transition-all duration-500`}
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Channel Stats Footer Info */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-center">
                <div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Avg Transaction</div>
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-0.5">$38.50</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Active POS Terminals</div>
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-0.5">14 active</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Checkout Load</div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-450 mt-0.5">Optimum</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
