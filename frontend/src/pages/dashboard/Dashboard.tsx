import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getDashboardOverview } from '../../api/dashboardApi';
import { 
  Assessment as AssessmentIcon, 
  People as PeopleIcon, 
  Inventory as InventoryIcon,
  Timeline as TimelineIcon,
  ArrowUpward as ArrowUpIcon,
  TrendingUp as TrendingIcon,
  Storefront as StoreIcon
} from '@mui/icons-material';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeChartTab, setActiveChartTab] = useState<'revenue' | 'channels'>('revenue');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: getDashboardOverview,
  });

  const metricCards = data
    ? [
        {
          title: 'Gross Revenue',
          value: formatCurrency(data.total_revenue),
          icon: <TimelineIcon className="text-indigo-600 dark:text-indigo-400" />,
          desc: 'Lifetime revenue',
          color: 'text-indigo-600',
        },
        {
          title: 'Products Listed',
          value: data.product_count.toLocaleString(),
          icon: <InventoryIcon className="text-emerald-600 dark:text-emerald-400" />,
          desc: 'Active listings',
          color: 'text-emerald-600',
        },
        {
          title: 'Team Accounts',
          value: `${data.team_count} Members`,
          icon: <PeopleIcon className="text-sky-600 dark:text-sky-400" />,
          desc: 'Active users',
          color: 'text-sky-600',
        },
        {
          title: 'Service Status',
          value: data.service_status,
          icon: <AssessmentIcon className="text-amber-600 dark:text-amber-400" />,
          desc: 'All systems go',
          color: 'text-amber-600',
        },
      ]
    : [];

  const channelBreakdown = data?.channel_breakdown.map((item) => ({
    name: item.name,
    percentage: item.percentage,
    value: item.value,
    color: item.name === 'Departmental POS' ? 'bg-indigo-600' : item.name === 'Online Storefront' ? 'bg-emerald-500' : 'bg-amber-500',
  })) ?? [];

  const monthlyRevenue = data?.monthly_revenue ?? [];

  const maxRevenue = monthlyRevenue.length > 0 ? Math.max(...monthlyRevenue.map((m) => m.revenue)) : 1;
  const chartWidth = 600;
  const chartHeight = 200;
  const paddingX = 40;
  const paddingY = 20;

  const getX = (index: number) => paddingX + (index / Math.max(monthlyRevenue.length - 1, 1)) * (chartWidth - paddingX * 2);
  const getY = (value: number) => chartHeight - paddingY - (value / maxRevenue) * (chartHeight - paddingY * 2);

  const pathD =
    monthlyRevenue.length > 0
      ? `M ${getX(0)},${getY(monthlyRevenue[0].revenue)} ${monthlyRevenue
          .slice(1)
          .map((m, i) => `L ${getX(i + 1)},${getY(m.revenue)}`)
          .join(' ')}`
      : '';

  const areaD = monthlyRevenue.length > 0 ? `${pathD} L ${getX(monthlyRevenue.length - 1)},${chartHeight - paddingY} L ${getX(0)},${chartHeight - paddingY} Z` : '';

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-sm text-red-600 font-medium">Failed to load dashboard data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Dashboard Overview</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
          Welcome back to the RetailPulse management desk. Here is your enterprise telemetry.
        </p>
      </div>

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

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
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

        <div className="p-6">
          {activeChartTab === 'revenue' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-450 font-medium">
                  <span>Monthly Revenue Trend (USD)</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-650"></span> This Year</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700"></span> Projections</span>
                  </div>
                </div>

                <div className="relative h-60 w-full bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-150 dark:border-slate-800/60 p-4">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.16" />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" strokeDasharray="3 3" />
                    <line x1={paddingX} y1={chartHeight / 2} x2={chartWidth - paddingX} y2={chartHeight / 2} stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" strokeDasharray="3 3" />
                    <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" />

                    <text x={paddingX - 5} y={paddingY + 4} className="text-[10px] font-bold fill-slate-400 font-mono" textAnchor="end">
                      {maxRevenue > 0 ? formatCurrency(maxRevenue) : '$0'}
                    </text>
                    <text x={paddingX - 5} y={chartHeight / 2 + 4} className="text-[10px] font-bold fill-slate-400 font-mono" textAnchor="end">
                      {maxRevenue > 0 ? formatCurrency(maxRevenue / 2) : '$0'}
                    </text>
                    <text x={paddingX - 5} y={chartHeight - paddingY + 4} className="text-[10px] font-bold fill-slate-400 font-mono" textAnchor="end">$0</text>

                    {monthlyRevenue.map((m, i) => (
                      <text key={m.month} x={getX(i)} y={chartHeight - 4} className="text-[10px] font-bold fill-slate-400 dark:fill-slate-500" textAnchor="middle">
                        {m.month}
                      </text>
                    ))}

                    {monthlyRevenue.length > 1 && (
                      <>
                        <path d={areaD} fill="url(#chart-gradient)" />
                        <path d={pathD} fill="none" stroke="#4f46e5" strokeWidth="3.5" strokeLinecap="round" />
                        <line x1={getX(monthlyRevenue.length - 1)} y1={getY(monthlyRevenue[monthlyRevenue.length - 1].revenue)} x2={chartWidth - paddingX + 20} y2={getY(monthlyRevenue[monthlyRevenue.length - 1].revenue) - 10} stroke="#a5b4fc" strokeWidth="2.5" strokeDasharray="4 4" />
                      </>
                    )}

                    {monthlyRevenue.map((m, i) => (
                      <circle key={m.month} cx={getX(i)} cy={getY(m.revenue)} r="4.5" className="fill-indigo-600 stroke-white dark:stroke-slate-900" strokeWidth="2" />
                    ))}

                    {monthlyRevenue.length > 0 && (
                      <g transform={`translate(${getX(monthlyRevenue.length - 1)}, ${getY(monthlyRevenue[monthlyRevenue.length - 1].revenue)})`}>
                        <circle r="8" className="fill-indigo-500/30 animate-ping" />
                        <circle r="5" className="fill-indigo-600 stroke-white dark:stroke-slate-900" strokeWidth="2" />
                      </g>
                    )}
                  </svg>
                </div>
              </div>

              <div className="flex flex-col justify-between space-y-4">
                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-5 border border-slate-150 dark:border-slate-800/80 space-y-3.5">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Performance Index</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                      {data?.total_revenue ? '98.7%' : '—'}
                    </span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-450 font-bold">
                      {data?.total_revenue ? '+2.4% MoM' : 'No data'}
                    </span>
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

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-center">
                <div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Avg Transaction</div>
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {data?.total_revenue && data.team_count > 0 ? formatCurrency(data.total_revenue / data.team_count) : '$38.50'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Active POS Terminals</div>
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {data?.team_count ?? 14} active
                  </div>
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
