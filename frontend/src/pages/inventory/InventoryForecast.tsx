import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  getInventoryForecasts,
  getInventoryForecastSummary,
  getRecommendations,
  getProductRecommendation,
  getBrands,
} from '../../api/inventoryApi';
import type {
  InventoryForecastItem,
  ProductRecommendationDetail,
  InventoryForecastSummary,
  PaginatedInventoryForecastResponse,
} from '../../api/inventoryApi';
import { getCategories } from '../../api/categoryApi';
import type { Category } from '../../api/categoryApi';
import {
  TrendingUp as TrendingIcon,
  RemoveShoppingCart as OutOfStockIcon,
  ShowChart as ChartIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  ShoppingCart as CartIcon,
  FilterList as FilterListIcon,
  Close as CloseIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

const FORECAST_PERIODS = [
  { value: 'NEXT_7_DAYS', label: 'Next 7 Days' },
  { value: 'NEXT_30_DAYS', label: 'Next 30 Days' },
  { value: 'NEXT_90_DAYS', label: 'Next 90 Days' },
];

const STOCK_RISK_STYLES: Record<string, string> = {
  OUT_OF_STOCK: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30',
  STOCKOUT_RISK: 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/30',
  LOW_STOCK: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30',
  HEALTHY: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30',
  OVERSTOCK: 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-900/30',
};

const REC_STYLES: Record<string, string> = {
  'Immediate restock required': 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30',
  'Reorder immediately': 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/30',
  'Reorder soon': 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30',
  'Consider reordering': 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-900/30',
  'No action needed': 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30',
  'Reduce orders or promote sales': 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-900/30',
};

const inputClass =
  'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition-all';

export const InventoryForecast: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  const [forecastPeriod, setForecastPeriod] = useState('NEXT_30_DAYS');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [stockRiskFilter, setStockRiskFilter] = useState('');
  const [reorderRequiredFilter, setReorderRequiredFilter] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState('days_of_stock_remaining');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<InventoryForecastItem | null>(null);
  const [recommendationDetail, setRecommendationDetail] = useState<ProductRecommendationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });

  const { data: brands = [] } = useQuery<string[]>({
    queryKey: ['inventory', 'brands'],
    queryFn: getBrands,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<InventoryForecastSummary>({
    queryKey: ['inventory-forecast', 'summary', forecastPeriod],
    queryFn: () => getInventoryForecastSummary(forecastPeriod),
  });

  const { data: forecastData, isLoading: forecastLoading, error: forecastError } = useQuery<PaginatedInventoryForecastResponse>({
    queryKey: ['inventory-forecast', { forecastPeriod, categoryFilter, brandFilter, stockRiskFilter, reorderRequiredFilter, search, sortBy, sortDir, page }],
    queryFn: () =>
      getInventoryForecasts({
        forecast_period: forecastPeriod,
        category_id: categoryFilter || undefined,
        brand: brandFilter || undefined,
        stock_risk: stockRiskFilter || undefined,
        reorder_required: reorderRequiredFilter,
        search: search || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
        page,
        limit: 20,
      }),
  });

  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery<PaginatedInventoryForecastResponse>({
    queryKey: ['inventory-recommendations', { forecastPeriod, categoryFilter, search, sortBy, sortDir, page }],
    queryFn: () =>
      getRecommendations({
        forecast_period: forecastPeriod,
        category_id: categoryFilter || undefined,
        search: search || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
        page,
        limit: 20,
      }),
  });

  const handleSelectProduct = async (item: InventoryForecastItem) => {
    setSelectedProduct(item);
    setDetailLoading(true);
    try {
      const detail = await getProductRecommendation(item.product_id, forecastPeriod);
      setRecommendationDetail(detail);
    } catch (err: any) {
      showNotification(err?.response?.data?.detail || 'Failed to load recommendation', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedProduct(null);
    setRecommendationDetail(null);
  };

  const summaryCards = useMemo(() => {
    if (!summary) return [];
    return [
      { id: 'reorder', title: 'Products Requiring Reorder', value: (summary.products_requiring_reorder || 0).toLocaleString(), icon: <CartIcon className="text-white" />, color: 'from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900', border: 'border-amber-100 dark:border-amber-900/40', accent: 'bg-amber-600', text: 'text-amber-700 dark:text-amber-300' },
      { id: 'stockout', title: 'Products at Stockout Risk', value: (summary.products_at_stockout_risk || 0).toLocaleString(), icon: <OutOfStockIcon className="text-white" />, color: 'from-red-50 to-white dark:from-red-950/30 dark:to-slate-900', border: 'border-red-100 dark:border-red-900/40', accent: 'bg-red-600', text: 'text-red-700 dark:text-red-300' },
      { id: 'overstock', title: 'Overstocked Products', value: (summary.overstocked_products || 0).toLocaleString(), icon: <WarningIcon className="text-white" />, color: 'from-violet-50 to-white dark:from-violet-950/30 dark:to-slate-900', border: 'border-violet-100 dark:border-violet-900/40', accent: 'bg-violet-600', text: 'text-violet-700 dark:text-violet-300' },
      { id: 'healthy', title: 'Healthy Products', value: (summary.healthy_products || 0).toLocaleString(), icon: <CheckIcon className="text-white" />, color: 'from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900', border: 'border-emerald-100 dark:border-emerald-900/40', accent: 'bg-emerald-600', text: 'text-emerald-700 dark:text-emerald-300' },
    ];
  }, [summary]);

  const chartData = useMemo(() => {
    if (!forecastData?.data) return [];
    return forecastData.data.slice(0, 10).map((item) => {
      const rawDays = item.days_of_stock_remaining;
      const cappedDays = rawDays > 180 ? 180 : Math.max(0, rawDays);
      return {
        name: item.product_name.length > 18 ? item.product_name.slice(0, 18) + '…' : item.product_name,
        fullName: item.product_name,
        daysRemaining: cappedDays,
        actualDays: rawDays,
        reorderPoint: item.reorder_point,
        currentStock: item.current_stock,
      };
    });
  }, [forecastData]);

  const stockRiskDistribution = useMemo(() => {
    if (!forecastData?.data) return [];
    const counts: Record<string, number> = {};
    for (const item of forecastData.data) {
      counts[item.stock_risk] = (counts[item.stock_risk] || 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name: name.replace(/_/g, ' '), count }));
  }, [forecastData]);

  const riskColors: Record<string, string> = {
    'OUT OF STOCK': '#ef4444',
    'STOCKOUT RISK': '#f97316',
    'LOW STOCK': '#f59e0b',
    'HEALTHY': '#10b981',
    'OVERSTOCK': '#8b5cf6',
  };

  const displayData = recommendationsData?.data ?? forecastData?.data ?? [];
  const displayTotal = recommendationsData?.total ?? forecastData?.total ?? 0;

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <ChartIcon className="text-indigo-600 dark:text-indigo-400" />
            Inventory Forecast & Replenishment
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Company: <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{user?.company}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={forecastPeriod}
            onChange={(e) => { setForecastPeriod(e.target.value); setPage(1); }}
            className={`${inputClass} lg:w-44`}
          >
            {FORECAST_PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        {summaryLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 animate-pulse">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-3" />
                <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))
          : summaryCards.map((item) => (
              <div key={item.id} className={`relative overflow-hidden rounded-2xl p-4 border shadow-sm bg-gradient-to-br ${item.color} ${item.border}`}>
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${item.accent}`} />
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">{item.title}</div>
                <div className={`text-xl font-extrabold tracking-tight ${item.text}`}>{item.value}</div>
              </div>
            ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
            <ChartIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Days of Stock Remaining</h2>
          </div>
          <div className="p-4 h-80">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }}
                    itemStyle={{ color: '#818cf8', fontWeight: 600 }}
                    labelStyle={{ color: '#cbd5e1', fontWeight: 600 }}
                    formatter={(value: any, _name: any, item: any) => {
                      const actual = item?.payload?.actualDays ?? value;
                      const formatted = actual >= 9999 ? 'N/A (No Sales)' : actual > 180 ? `${actual.toFixed(1)} days (180+)` : `${actual.toFixed(1)} days`;
                      return [formatted, 'Days Remaining'];
                    }}
                    labelFormatter={(label: string, payload: any[]) => payload?.[0]?.payload?.fullName || label}
                  />
                  <Bar dataKey="daysRemaining" radius={[4, 4, 4, 4]} barSize={16}>
                    {chartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#4f46e5' : '#6366f1'} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                <ChartIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                <span className="text-xs font-semibold">No chart data available</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
            <TrendingIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Stock Risk Distribution</h2>
          </div>
          <div className="p-4 h-80">
            {stockRiskDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockRiskDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }}
                    itemStyle={{ color: '#38bdf8', fontWeight: 600 }}
                    labelStyle={{ color: '#cbd5e1', fontWeight: 600 }}
                    formatter={(value: any) => [`${value} product(s)`, 'Count']}
                  />
                  <Bar dataKey="count" radius={[4, 4, 4, 4]} barSize={16}>
                    {stockRiskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={riskColors[entry.name] || '#6366f1'} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                <TrendingIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                <span className="text-xs font-semibold">No risk data available</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          <FilterListIcon style={{ fontSize: 16 }} />
          Filters
        </div>
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className={inputClass}
        />
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className={`${inputClass} lg:w-44`}>
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }} className={`${inputClass} lg:w-36`}>
          <option value="">All Brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select value={stockRiskFilter} onChange={(e) => { setStockRiskFilter(e.target.value); setPage(1); }} className={`${inputClass} lg:w-40`}>
          <option value="">All Risks</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
          <option value="STOCKOUT_RISK">Stockout Risk</option>
          <option value="LOW_STOCK">Low Stock</option>
          <option value="HEALTHY">Healthy</option>
          <option value="OVERSTOCK">Overstock</option>
        </select>
        <select
          value={reorderRequiredFilter === undefined ? '' : reorderRequiredFilter ? 'true' : 'false'}
          onChange={(e) => {
            const val = e.target.value;
            setReorderRequiredFilter(val === '' ? undefined : val === 'true');
            setPage(1);
          }}
          className={`${inputClass} lg:w-40`}
        >
          <option value="">All Reorder Status</option>
          <option value="true">Reorder Required</option>
          <option value="false">No Reorder</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`${inputClass} lg:w-44`}>
          <option value="days_of_stock_remaining">Sort: Days Remaining</option>
          <option value="current_stock">Sort: Current Stock</option>
          <option value="forecasted_demand">Sort: Forecasted Demand</option>
          <option value="recommended_reorder_quantity">Sort: Recommended Qty</option>
          <option value="average_daily_sales">Sort: Avg Daily Sales</option>
          <option value="reorder_point">Sort: Reorder Point</option>
          <option value="product_name">Sort: Product Name</option>
        </select>
        <select value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')} className={`${inputClass} lg:w-28`}>
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>

      {/* Forecast Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Product</th>
                <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Current Stock</th>
                <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Avg Daily Sales</th>
                <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Forecasted Demand</th>
                <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Days Remaining</th>
                <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Reorder Point</th>
                <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Recommended Qty</th>
                <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Stock Risk</th>
                <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {forecastLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={10} className="px-4 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /></td></tr>
                ))
              ) : forecastError ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-red-500 text-xs font-semibold">Failed to load forecast data. Please try again.</td></tr>
              ) : displayData.length > 0 ? (
                displayData.map((item) => (
                  <tr
                    key={item.product_id}
                    onClick={() => handleSelectProduct(item)}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors cursor-pointer ${selectedProduct?.product_id === item.product_id ? 'bg-indigo-50 dark:bg-indigo-950/20' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{item.product_name}</div>
                      <div className="text-[10px] text-slate-400">{item.product_sku}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.category_name || '-'}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-slate-100">{item.current_stock}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-slate-100">{item.average_daily_sales.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right font-mono text-indigo-600 dark:text-indigo-400 font-bold">{item.forecasted_demand}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={item.days_of_stock_remaining < 7 ? 'text-red-600 dark:text-red-400 font-bold' : item.days_of_stock_remaining < 14 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-900 dark:text-slate-100'}>
                        {item.days_of_stock_remaining === 9999.0 ? 'N/A' : item.days_of_stock_remaining}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-slate-100">{item.reorder_point}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={item.recommended_reorder_quantity > 0 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500'}>
                        {item.recommended_reorder_quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STOCK_RISK_STYLES[item.stock_risk] || 'bg-slate-100 text-slate-600'}`}>
                        {item.stock_risk.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${REC_STYLES[item.recommendation] || 'bg-slate-100 text-slate-600'}`}>
                        {item.recommendation}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400 text-xs font-semibold">No forecast data available. Generate forecasts first.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {displayTotal > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500">Page {page} of {Math.ceil(displayTotal / 20)}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800">Prev</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= displayTotal} className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Recommendation Comparison Panel */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-modal-enter">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Recommendation: {selectedProduct.product_name}
              </h2>
              <button onClick={handleCloseDetail} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <CloseIcon style={{ fontSize: 20 }} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {detailLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
                </div>
              ) : recommendationDetail ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Current</h3>
                      {[
                        { label: 'Stock', value: recommendationDetail.current_stock, highlight: recommendationDetail.current_stock < recommendationDetail.reorder_point },
                        { label: 'Available Stock', value: recommendationDetail.available_stock, highlight: recommendationDetail.available_stock < recommendationDetail.reorder_point },
                        { label: 'Avg Daily Sales', value: recommendationDetail.average_daily_sales.toFixed(1), highlight: false },
                        { label: 'Forecasted Demand', value: recommendationDetail.forecasted_demand, highlight: false },
                        { label: 'Days Remaining', value: recommendationDetail.days_of_stock_remaining === 9999.0 ? 'N/A' : recommendationDetail.days_of_stock_remaining, highlight: recommendationDetail.days_of_stock_remaining < 7 },
                        { label: 'Reorder Point', value: recommendationDetail.reorder_point, highlight: false },
                        { label: 'Safety Stock', value: recommendationDetail.safety_stock, highlight: false },
                      ].map((metric) => (
                        <div key={metric.label} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-xs text-slate-600 dark:text-slate-300">{metric.label}</span>
                          <span className={`text-xs font-bold ${metric.highlight ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                            {metric.value}
                            {metric.highlight && <WarningIcon style={{ fontSize: 14 }} className="ml-1 inline-block" />}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Recommended</h3>
                      {[
                        { label: 'Recommended Qty', value: recommendationDetail.recommended_reorder_quantity, highlight: recommendationDetail.recommended_reorder_quantity > 0 },
                        { label: 'Target Stock', value: recommendationDetail.reorder_point + Math.max(recommendationDetail.forecasted_demand, recommendationDetail.safety_stock), highlight: recommendationDetail.current_stock < (recommendationDetail.reorder_point + Math.max(recommendationDetail.forecasted_demand, recommendationDetail.safety_stock)) },
                        { label: 'Lead Time', value: `${recommendationDetail.lead_time_days} days`, highlight: false },
                        { label: 'Safety Stock', value: recommendationDetail.safety_stock, highlight: false },
                        { label: 'Confidence', value: `${recommendationDetail.confidence_score.toFixed(1)}%`, highlight: false },
                        { label: 'Historical Sales', value: recommendationDetail.historical_sales, highlight: false },
                        { label: 'Stock Risk', value: recommendationDetail.stock_risk.replace(/_/g, ' '), highlight: recommendationDetail.stock_risk !== 'HEALTHY' },
                      ].map((metric) => (
                        <div key={metric.label} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-xs text-slate-600 dark:text-slate-300">{metric.label}</span>
                          <span className={`text-xs font-bold ${metric.highlight ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                            {metric.value}
                            {metric.highlight && <WarningIcon style={{ fontSize: 14 }} className="ml-1 inline-block" />}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`rounded-xl p-4 border ${recommendationDetail.stock_risk === 'OUT_OF_STOCK' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40' : recommendationDetail.stock_risk === 'STOCKOUT_RISK' ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/40' : recommendationDetail.stock_risk === 'LOW_STOCK' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40' : recommendationDetail.stock_risk === 'OVERSTOCK' ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-900/40' : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STOCK_RISK_STYLES[recommendationDetail.stock_risk] || 'bg-slate-100 text-slate-600'}`}>
                        {recommendationDetail.stock_risk.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${REC_STYLES[recommendationDetail.recommendation] || 'bg-slate-100 text-slate-600'}`}>
                        {recommendationDetail.recommendation}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {recommendationDetail.recommended_reorder_quantity > 0
                        ? `Order ${recommendationDetail.recommended_reorder_quantity} units to reach target stock level of ${recommendationDetail.reorder_point + Math.max(recommendationDetail.forecasted_demand, recommendationDetail.safety_stock)}.`
                        : 'Current stock is sufficient for the forecast period.'}
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center text-slate-400 text-xs py-8">Failed to load recommendation details.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryForecast;