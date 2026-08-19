import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Payment as PaymentIcon } from '@mui/icons-material';
import { formatCurrency } from '../../../utils/currency';
import type { PaymentMethodBreakdown } from '../../../api/analyticsApi';

const PAYMENT_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface PaymentMethodsChartProps {
  data: PaymentMethodBreakdown[];
  loading: boolean;
}

const PaymentMethodsChart: React.FC<PaymentMethodsChartProps> = ({ data, loading }) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
        <PaymentIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Payment Method Analysis</h2>
      </div>
      <div className="p-4 h-80">
        {loading ? (
          <div className="animate-pulse flex items-center justify-center h-full">
            <div className="w-full h-full bg-slate-200 dark:bg-slate-800 rounded-lg" />
          </div>
        ) : data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="total_revenue"
                nameKey="payment_method"
                cx="50%"
                cy="50%"
                outerRadius={90}
                paddingAngle={4}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
              >
                {data.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any, name: any, props: any) => {
                  const payload = props.payload as PaymentMethodBreakdown;
                  return [`${formatCurrency(value)} (${payload.total_orders} orders)`, name];
                }}
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }}
                itemStyle={{ color: '#818cf8' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
            <PaymentIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
            <span className="text-xs font-semibold">No payment method data available</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentMethodsChart;
