import React from 'react';
import {
  AttachMoney as MoneyIcon,
  ShoppingCart as CartIcon,
  TrendingUp as TrendingIcon,
  ShoppingBag as BagIcon,
  Receipt as ReceiptIcon,
  ShowChart as ChartIcon,
} from '@mui/icons-material';
import { formatCurrency } from '../../../utils/currency';
import type { KPIDashboardResponse } from '../../../api/analyticsApi';

interface KPIItem {
  id: string;
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  border: string;
  accent: string;
  text: string;
}

interface AnalyticsKpisProps {
  kpis: KPIDashboardResponse | undefined;
  loading: boolean;
  error: Error | null;
}

const AnalyticsKpis: React.FC<AnalyticsKpisProps> = ({ kpis, loading, error }) => {
  const kpiCards = React.useMemo(() => {
    if (!kpis) return [];
    return [
      { id: 'revenue', title: 'Total Revenue', value: formatCurrency(kpis.total_revenue || 0), icon: <MoneyIcon className="text-white" />, color: 'from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-900', border: 'border-indigo-100 dark:border-indigo-900/40', accent: 'bg-indigo-600', text: 'text-indigo-700 dark:text-indigo-300' },
      { id: 'orders', title: 'Total Orders', value: (kpis.total_orders || 0).toLocaleString(), icon: <CartIcon className="text-white" />, color: 'from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900', border: 'border-emerald-100 dark:border-emerald-900/40', accent: 'bg-emerald-600', text: 'text-emerald-700 dark:text-emerald-300' },
      { id: 'aov', title: 'Avg Order Value', value: formatCurrency(kpis.average_order_value || 0), icon: <TrendingIcon className="text-white" />, color: 'from-violet-50 to-white dark:from-violet-950/30 dark:to-slate-900', border: 'border-violet-100 dark:border-violet-900/40', accent: 'bg-violet-600', text: 'text-violet-700 dark:text-violet-300' },
      { id: 'items_sold', title: 'Total Items Sold', value: (kpis.total_products_sold || 0).toLocaleString(), icon: <BagIcon className="text-white" />, color: 'from-pink-50 to-white dark:from-pink-950/30 dark:to-slate-900', border: 'border-pink-100 dark:border-pink-900/40', accent: 'bg-pink-600', text: 'text-pink-700 dark:text-pink-300' },
      { id: 'discount', title: 'Total Discount', value: formatCurrency(kpis.total_discount || 0), icon: <ReceiptIcon className="text-white" />, color: 'from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900', border: 'border-amber-100 dark:border-amber-900/40', accent: 'bg-amber-600', text: 'text-amber-700 dark:text-amber-300' },
      { id: 'tax', title: 'Total Tax', value: formatCurrency(kpis.total_tax || 0), icon: <ChartIcon className="text-white" />, color: 'from-orange-50 to-white dark:from-orange-950/30 dark:to-slate-900', border: 'border-orange-100 dark:border-orange-900/40', accent: 'bg-orange-600', text: 'text-orange-700 dark:text-orange-300' },
    ] as KPIItem[];
  }, [kpis]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-400">
        Failed to load KPI data. Please try refreshing the page.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-5">
      {loading
        ? Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-5 bg-white dark:bg-slate-900 animate-pulse">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-3" />
              <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-1" />
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))
        : kpiCards.map((item) => (
            <div
              key={item.id}
              className={`relative overflow-hidden rounded-2xl p-4 md:p-5 border shadow-sm bg-gradient-to-br ${item.color} ${item.border}`}
            >
              <div className={`absolute top-0 left-0 right-0 h-0.5 ${item.accent}`} />
              <div className="flex items-start justify-between mb-3">
                <span className="text-[10px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-tight">{item.title}</span>
                <div className={`h-8 w-8 md:h-9 md:w-9 rounded-xl flex items-center justify-center shadow-md shrink-0 ${item.accent}`}>
                  {item.icon}
                </div>
              </div>
              <div className={`text-2xl md:text-3xl font-extrabold tracking-tight mb-1 ${item.text}`}>{item.value}</div>
            </div>
          ))}
    </div>
  );
};

export default AnalyticsKpis;
