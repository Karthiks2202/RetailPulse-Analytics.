import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getDashboardOverview, getCategoryBreakdown, getStatusBreakdown } from '../../api/dashboardApi';
import { formatCurrency } from '../../utils/currency';
import {
  Inventory as InventoryIcon,
  ArrowUpward as ArrowUpIcon,
  TrendingUp as TrendingIcon,
  Storefront as StoreIcon,
  Category as CategoryIcon,
  CheckCircle as CheckCircleIcon,
  Block as BlockIcon,
  Receipt as ReceiptIcon,
  ShoppingCart as CartIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';



export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeChartTab, setActiveChartTab] = useState<'revenue' | 'channels'>('revenue');

  const { data } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: getDashboardOverview,
  });

  const metricCards = data
    ? [
        {
          title: 'Total Products',
          value: data.product_count.toLocaleString(),
          icon: <InventoryIcon className="text-white" />,
          desc: 'All listings',
          iconBg: 'bg-indigo-500',
          cardBg: 'bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-900',
          border: 'border-indigo-100 dark:border-indigo-900/30',
          accent: 'bg-indigo-500',
          valueColor: 'text-indigo-700 dark:text-indigo-300',
          descColor: 'text-indigo-500 dark:text-indigo-400',
        },
        {
          title: 'Active Products',
          value: data.active_product_count.toLocaleString(),
          icon: <CheckCircleIcon className="text-white" />,
          desc: 'Available for sale',
          iconBg: 'bg-emerald-500',
          cardBg: 'bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900',
          border: 'border-emerald-100 dark:border-emerald-900/30',
          accent: 'bg-emerald-500',
          valueColor: 'text-emerald-700 dark:text-emerald-300',
          descColor: 'text-emerald-500 dark:text-emerald-400',
        },
        {
          title: 'Inactive Products',
          value: data.inactive_product_count.toLocaleString(),
          icon: <BlockIcon className="text-white" />,
          desc: 'Hidden from view',
          iconBg: 'bg-amber-500',
          cardBg: 'bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900',
          border: 'border-amber-100 dark:border-amber-900/30',
          accent: 'bg-amber-500',
          valueColor: 'text-amber-700 dark:text-amber-300',
          descColor: 'text-amber-500 dark:text-amber-400',
        },
        {
          title: 'Total Categories',
          value: data.category_count.toLocaleString(),
          icon: <CategoryIcon className="text-white" />,
          desc: 'Product groups',
          iconBg: 'bg-sky-500',
          cardBg: 'bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/20 dark:to-slate-900',
          border: 'border-sky-100 dark:border-sky-900/30',
          accent: 'bg-sky-500',
          valueColor: 'text-sky-700 dark:text-sky-300',
          descColor: 'text-sky-500 dark:text-sky-400',
        },
        {
          title: 'Total Sales',
          value: (data.total_sales || 0).toLocaleString(),
          icon: <ReceiptIcon className="text-white" />,
          desc: 'Transactions',
          iconBg: 'bg-violet-500',
          cardBg: 'bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/20 dark:to-slate-900',
          border: 'border-violet-100 dark:border-violet-900/30',
          accent: 'bg-violet-500',
          valueColor: 'text-violet-700 dark:text-violet-300',
          descColor: 'text-violet-500 dark:text-violet-400',
        },
        {
          title: 'Total Revenue',
          value: formatCurrency(data.total_revenue || 0),
          icon: <MoneyIcon className="text-white" />,
          desc: 'Lifetime revenue',
          iconBg: 'bg-emerald-500',
          cardBg: 'bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900',
          border: 'border-emerald-100 dark:border-emerald-900/30',
          accent: 'bg-emerald-500',
          valueColor: 'text-emerald-700 dark:text-emerald-300',
          descColor: 'text-emerald-500 dark:text-emerald-400',
        },
        {
          title: 'Total Orders',
          value: (data.total_orders || 0).toLocaleString(),
          icon: <CartIcon className="text-white" />,
          desc: 'Items sold',
          iconBg: 'bg-orange-500',
          cardBg: 'bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20 dark:to-slate-900',
          border: 'border-orange-100 dark:border-orange-900/30',
          accent: 'bg-orange-500',
          valueColor: 'text-orange-700 dark:text-orange-300',
          descColor: 'text-orange-500 dark:text-orange-400',
        },
        {
          title: 'Avg Order Value',
          value: formatCurrency(data.average_order_value || 0),
          icon: <TrendingIcon className="text-white" />,
          desc: 'Per transaction',
          iconBg: 'bg-pink-500',
          cardBg: 'bg-gradient-to-br from-pink-50 to-white dark:from-pink-950/20 dark:to-slate-900',
          border: 'border-pink-100 dark:border-pink-900/30',
          accent: 'bg-pink-500',
          valueColor: 'text-pink-700 dark:text-pink-300',
          descColor: 'text-pink-500 dark:text-pink-400',
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

  const { data: catBreakdown = [] } = useQuery({
    queryKey: ['dashboard', 'category-breakdown'],
    queryFn: getCategoryBreakdown,
  });

  const { data: statusBreakdown = [] } = useQuery({
    queryKey: ['dashboard', 'status-breakdown'],
    queryFn: getStatusBreakdown,
  });

  const catChartData = catBreakdown.map((c) => ({
    name: c.category_name.length > 15 ? c.category_name.slice(0, 15) + '…' : c.category_name,
    count: c.product_count,
  }));

  const statusChartData = statusBreakdown.map((s) => ({
    name: s.stock_status.replace(/_/g, ' '),
    count: s.product_count,
  }));

  const statusColors: Record<string, string> = {
    IN_STOCK: '#10b981',
    LOW_STOCK: '#f59e0b',
    OUT_OF_STOCK: '#ef4444',
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Dashboard Overview
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
          Welcome back, <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{user?.name?.split(' ')[0]}</span>. Here's your RetailPulse snapshot.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        {metricCards.map((item, idx) => (
          <div
            key={idx}
            className={`relative overflow-hidden rounded-2xl p-4 md:p-5 border shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group ${item.cardBg} ${item.border}`}
          >
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${item.accent}`}/>
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-tight">{item.title}</span>
              <div className={`h-8 w-8 md:h-9 md:w-9 rounded-xl flex items-center justify-center shadow-md shrink-0 ${item.iconBg}`}>
                {item.icon}
              </div>
            </div>
            <div className={`text-2xl md:text-3xl font-extrabold tracking-tight mb-1 ${item.valueColor}`}>{item.value}</div>
            <div className={`text-[10px] md:text-xs font-semibold flex items-center gap-1 ${item.descColor}`}>
              <ArrowUpIcon style={{ fontSize: 11 }} />
              {item.desc}
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
                  <span>Monthly Revenue Trend</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-650"></span> This Year</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700"></span> Projections</span>
                  </div>
                </div>

                <div className="relative h-60 w-full bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-150 dark:border-slate-800/60 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyRevenue} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.16} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} width={70} />
                      <Tooltip
                        formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                        contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                        cursor={{ stroke: '#6366f1', strokeWidth: 1.5 }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3.5} fillOpacity={1} fill="url(#chartGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
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
                    {data?.total_revenue && data.team_count > 0 ? formatCurrency(data.total_revenue / data.team_count) : formatCurrency(38.50)}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
            <CategoryIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Inventory by Category</h2>
          </div>
          <div className="p-4 h-64">
            {catChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(99,102,241,0.08)' }} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="count" radius={[4, 4, 4, 4]} barSize={18}>
                    {catChartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill="#6366f1" fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-slate-400 dark:text-slate-500">No category data available</div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
            <TrendingIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Stock Status Distribution</h2>
          </div>
          <div className="p-4 h-64">
            {statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(99,102,241,0.08)' }} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="count" radius={[4, 4, 4, 4]} barSize={18}>
                    {statusChartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={statusColors[statusBreakdown[index]?.stock_status] || '#6366f1'} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-slate-400 dark:text-slate-500">No status data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
