import React from 'react';
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { ShoppingCart as CartIcon, Receipt as ReceiptIcon } from '@mui/icons-material';
import { formatCurrency } from '../../../utils/currency';
import type { SalesTrendPoint } from '../../../api/analyticsApi';

interface SalesVsOrdersChartProps {
  data: SalesTrendPoint[];
  loading: boolean;
}

const SalesVsOrdersChart: React.FC<SalesVsOrdersChartProps> = ({ data, loading }) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
        <CartIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Sales vs Orders</h2>
      </div>
      <div className="p-4 h-72">
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-lg h-full min-h-[180px]" />
          </div>
        ) : data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} width={70} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }}
                itemStyle={{ color: '#818cf8' }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value: any, name: any) => {
                  if (name === 'Revenue') return [formatCurrency(value), 'Revenue'];
                  return [value, 'Orders'];
                }}
              />
              <Bar yAxisId="left" dataKey="sales" radius={[4, 4, 0, 0]} barSize={24}>
                {data.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill="#6366f1" fillOpacity={0.85} />
                ))}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
            <ReceiptIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
            <span className="text-xs font-semibold">No sales vs orders data available</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesVsOrdersChart;
