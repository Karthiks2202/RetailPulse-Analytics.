import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { ShowChart as ChartIcon, Receipt as ReceiptIcon } from '@mui/icons-material';
import { formatCurrency } from '../../../utils/currency';
import type { RevenueTrendPoint } from '../../../api/analyticsApi';

const INTERVALS = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
] as const;

interface SalesOverviewChartProps {
  data: RevenueTrendPoint[];
  loading: boolean;
  interval: string;
  onIntervalChange: (value: string) => void;
}

const SalesOverviewChart: React.FC<SalesOverviewChartProps> = ({ data, loading, interval, onIntervalChange }) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="flex items-center gap-2">
          <ChartIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Sales Overview</h2>
        </div>
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800">
          {INTERVALS.map((int) => (
            <button
              key={int.value}
              onClick={() => onIntervalChange(int.value)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                interval === int.value
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {int.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 h-72">
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-lg h-full min-h-[180px]" />
          </div>
        ) : data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="salesRevGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.16} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} width={70} />
              <Tooltip
                formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }}
                itemStyle={{ color: '#818cf8' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3.5} fillOpacity={1} fill="url(#salesRevGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
            <ReceiptIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
            <span className="text-xs font-semibold">No revenue data available for selected filters</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesOverviewChart;
