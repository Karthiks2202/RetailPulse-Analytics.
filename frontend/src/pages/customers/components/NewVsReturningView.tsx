import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNewVsReturning } from '../../api/customerApi';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#10b981', '#6366f1'];

interface NewVsReturningViewProps {
  dateFrom?: string;
  dateTo?: string;
}

const NewVsReturningView: React.FC<NewVsReturningViewProps> = ({ dateFrom, dateTo }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['new-vs-returning', dateFrom, dateTo],
    queryFn: () => getNewVsReturning(dateFrom, dateTo),
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 text-xs">
        Failed to load data
      </div>
    );
  }

  const chartData = [
    { name: 'New Customers', value: data.new_customers || 0 },
    { name: 'Returning Customers', value: data.returning_customers || 0 },
  ];

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={80}
            dataKey="value"
            label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
          >
            {chartData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.85} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Revenue</p>
          <p className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.new_customer_revenue || 0)}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Returning Revenue</p>
          <p className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.returning_customer_revenue || 0)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default NewVsReturningView;
