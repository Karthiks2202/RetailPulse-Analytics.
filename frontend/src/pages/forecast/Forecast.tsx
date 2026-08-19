import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  getForecastKPIs,
  getProductForecasts,
  getCategoryForecasts,
  getTopPredictedProducts,
  getAccuracyTrend,
  generateForecasts,
  refreshForecasts,
  exportProductForecastCSV,
  exportCategoryForecastCSV,
  exportForecastPDF,
} from '../../api/forecastApi';
import { getProducts } from '../../api/productApi';
import { getCategories } from '../../api/categoryApi';
import {
  TrendingUp as TrendingIcon,
  RemoveShoppingCart as OutOfStockIcon,
  ShowChart as ChartIcon,
  AddCircle as AddCircleIcon,
  Refresh as RefreshIcon,
  FileDownload as ExportIcon,
  CheckCircle as CheckIcon,
  Warning as WarningAmberIcon,
  ShoppingCart as CartIcon,
  Timeline as TimelineIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
  FilterList as FilterListIcon,
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
  { value: 'CUSTOM', label: 'Custom Date Range' },
];

const REC_STYLES: Record<string, string> = {
  REORDER_SOON: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30',
  OVERSTOCK_RISK: 'bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-900/30',
  STOCK_LEVEL_HEALTHY: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30',
  IMMEDIATE_RESTOCK_REQUIRED: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30',
};

const inputClass =
  'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition-all';

export const Forecast: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'products' | 'categories' | 'analytics'>('products');
  const [forecastPeriod, setForecastPeriod] = useState('NEXT_30_DAYS');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('predicted_demand');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const { data: _products = [] } = useQuery({ queryKey: ['products', { status: 'ACTIVE' }], queryFn: () => getProducts({ status: 'ACTIVE' }) });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => getCategories() });

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['forecast', 'kpis', forecastPeriod],
    queryFn: () => getForecastKPIs({ forecast_period: forecastPeriod }),
    enabled: tab === 'analytics',
  });

  const { data: productForecasts, isLoading: productsLoading } = useQuery({
    queryKey: ['forecast', 'products', { forecastPeriod, categoryFilter, search, sortBy, sortDir, page }],
    queryFn: () => getProductForecasts({ forecast_period: forecastPeriod, category_id: categoryFilter || undefined, search: search || undefined, sort_by: sortBy, sort_dir: sortDir, page, limit: 20 }),
    enabled: tab === 'products',
  });

  const { data: categoryForecasts, isLoading: categoriesLoading } = useQuery({
    queryKey: ['forecast', 'categories', { forecastPeriod, sortBy, sortDir, page }],
    queryFn: () => getCategoryForecasts({ forecast_period: forecastPeriod, sort_by: sortBy, sort_dir: sortDir, page, limit: 20 }),
    enabled: tab === 'categories',
  });

  const { data: topProductsChart } = useQuery({
    queryKey: ['forecast', 'charts', 'top-products', forecastPeriod],
    queryFn: () => getTopPredictedProducts(forecastPeriod),
    enabled: tab === 'analytics',
  });

  const { data: accuracyTrend } = useQuery({
    queryKey: ['forecast', 'charts', 'accuracy-trend', forecastPeriod],
    queryFn: () => getAccuracyTrend(forecastPeriod),
    enabled: tab === 'analytics',
  });

  const generateMutation = useMutation({
    mutationFn: () => generateForecasts({
      forecast_period: forecastPeriod,
      forecast_start_date: customStart || undefined,
      forecast_end_date: customEnd || undefined,
    }),
    onSuccess: () => {
      showNotification('Forecast generated successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['forecast'] });
    },
    onError: (err: any) => {
      showNotification(err?.response?.data?.detail || 'Failed to generate forecast', 'error');
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshForecasts({ forecast_period: forecastPeriod }),
    onSuccess: () => {
      showNotification('Forecast refreshed successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['forecast'] });
    },
    onError: (err: any) => {
      showNotification(err?.response?.data?.detail || 'Failed to refresh forecast', 'error');
    },
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateMutation.mutateAsync();
    } finally {
      setGenerating(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshMutation.mutateAsync();
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportCSV = async (type: 'products' | 'categories') => {
    setExporting(`csv-${type}`);
    try {
      if (type === 'products') {
        const res = await exportProductForecastCSV(forecastPeriod);
        const blob = new Blob([res.content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', res.filename || 'product_forecast_report.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const res = await exportCategoryForecastCSV(forecastPeriod);
        const blob = new Blob([res.content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', res.filename || 'category_forecast_report.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      showNotification('CSV exported successfully', 'success');
    } catch {
      showNotification('Failed to export CSV', 'error');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      const blob = await exportForecastPDF(forecastPeriod);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'forecast_report.pdf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('PDF exported successfully', 'success');
    } catch {
      showNotification('Failed to export PDF', 'error');
    } finally {
      setExporting(null);
    }
  };

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    return [
      { id: 'predicted_demand', title: 'Total Predicted Demand', value: (kpis.total_predicted_demand || 0).toLocaleString(), icon: <CartIcon className="text-white" />, color: 'from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-900', border: 'border-indigo-100 dark:border-indigo-900/40', accent: 'bg-indigo-600', text: 'text-indigo-700 dark:text-indigo-300' },
      { id: 'run_out', title: 'Products Expected to Run Out', value: (kpis.products_expected_to_run_out || 0).toLocaleString(), icon: <OutOfStockIcon className="text-white" />, color: 'from-red-50 to-white dark:from-red-950/30 dark:to-slate-900', border: 'border-red-100 dark:border-red-900/40', accent: 'bg-red-600', text: 'text-red-700 dark:text-red-300' },
      { id: 'high_growth', title: 'High Growth Products', value: (kpis.high_growth_products || 0).toLocaleString(), icon: <TrendingIcon className="text-white" />, color: 'from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900', border: 'border-emerald-100 dark:border-emerald-900/40', accent: 'bg-emerald-600', text: 'text-emerald-700 dark:text-emerald-300' },
      { id: 'slow_moving', title: 'Slow Moving Products', value: (kpis.slow_moving_products || 0).toLocaleString(), icon: <WarningAmberIcon className="text-white" />, color: 'from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900', border: 'border-amber-100 dark:border-amber-900/40', accent: 'bg-amber-600', text: 'text-amber-700 dark:text-amber-300' },
      { id: 'accuracy', title: 'Forecast Accuracy', value: `${kpis.forecast_accuracy || 0}%`, icon: <CheckIcon className="text-white" />, color: 'from-violet-50 to-white dark:from-violet-950/30 dark:to-slate-900', border: 'border-violet-100 dark:border-violet-900/40', accent: 'bg-violet-600', text: 'text-violet-700 dark:text-violet-300' },
    ];
  }, [kpis]);

  const topProductsData = useMemo<Array<{ name: string; predicted: number; historical: number }>>(() => {
    if (!topProductsChart || !topProductsChart.top_predicted_products) return [];
    return topProductsChart.top_predicted_products.map((name: string, idx: number) => ({
      name,
      predicted: topProductsChart.predicted_demand[idx] || 0,
      historical: topProductsChart.historical_sales[idx] || 0,
    }));
  }, [topProductsChart]);

  const accuracyData = useMemo(() => {
    if (!accuracyTrend) return [];
    return accuracyTrend.map((item) => ({
      period: item.period,
      historical: item.historical,
      prediction: item.prediction,
      accuracy: item.accuracy,
    }));
  }, [accuracyTrend]);

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <ChartIcon className="text-indigo-600 dark:text-indigo-400" />
            Demand Forecasting
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Company: <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{user?.company}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={forecastPeriod}
            onChange={(e) => setForecastPeriod(e.target.value)}
            className={`${inputClass} lg:w-44`}
          >
            {FORECAST_PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {forecastPeriod === 'CUSTOM' && (
            <>
              <input type="date" className={inputClass} value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <span className="text-slate-400 text-xs">to</span>
              <input type="date" className={inputClass} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md disabled:opacity-50"
          >
            <AddCircleIcon style={{ fontSize: 16 }} />
            <span>{generating ? 'Generating...' : 'Generate Forecast'}</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshIcon className={refreshing ? 'animate-spin text-indigo-600' : ''} style={{ fontSize: 16 }} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <div className="relative group">
            <button className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm">
              <ExportIcon style={{ fontSize: 16 }} />
              <span>Export</span>
            </button>
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all p-2 space-y-1">
              <button onClick={() => handleExportCSV('products')} disabled={exporting === 'csv-products'} className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <CsvIcon fontSize="small" className="text-emerald-500" /> Product Forecast (CSV)
              </button>
              <button onClick={() => handleExportCSV('categories')} disabled={exporting === 'csv-categories'} className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <CsvIcon fontSize="small" className="text-emerald-500" /> Category Forecast (CSV)
              </button>
              <button onClick={handleExportPDF} disabled={exporting === 'pdf'} className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <PdfIcon fontSize="small" className="text-rose-500" /> Forecast Report (PDF)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm w-fit">
        {[
          { key: 'products', label: 'Product Level' },
          { key: 'categories', label: 'Category Level' },
          { key: 'analytics', label: 'Analytics Dashboard' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key as any); setPage(1); }}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === t.key
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Product Level Tab */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <FilterListIcon style={{ fontSize: 16 }} />
              Filters
            </div>
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputClass}
            />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${inputClass} lg:w-44`}>
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`${inputClass} lg:w-44`}>
              <option value="predicted_demand">Highest Predicted Demand</option>
              <option value="current_stock">Lowest Stock</option>
              <option value="confidence_score">Forecast Accuracy</option>
            </select>
            <select value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')} className={`${inputClass} lg:w-28`}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Current Stock</th>
                    <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Historical Sales</th>
                    <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Predicted Demand</th>
                    <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Confidence</th>
                    <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Recommendation</th>
                    <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {productsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={8} className="px-4 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /></td></tr>
                    ))
                  ) : productForecasts?.data?.length ? (
                    productForecasts.data.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{item.product_name}</div>
                          <div className="text-[10px] text-slate-400">{item.product_sku}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.category_name || '-'}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-slate-100">{item.current_stock}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-slate-100">{item.historical_sales}</td>
                        <td className="px-4 py-3 text-right font-mono text-indigo-600 dark:text-indigo-400 font-bold">{item.predicted_demand}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-slate-100">{item.confidence_score.toFixed(1)}%</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${REC_STYLES[item.recommendation || ''] || 'bg-slate-100 text-slate-600'}`}>
                            {(item.recommendation || '').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{new Date(item.generated_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-xs font-semibold">No forecasts available. Generate forecasts to see predictions.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {productForecasts && productForecasts.total > 20 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500">Page {page} of {Math.ceil(productForecasts.total / 20)}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800">Prev</button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= productForecasts.total} className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Level Tab */}
      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Total Historical Sales</th>
                    <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Predicted Demand</th>
                    <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right">Expected Growth</th>
                    <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Forecast Period</th>
                    <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {categoriesLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={6} className="px-4 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /></td></tr>
                    ))
                  ) : categoryForecasts?.data?.length ? (
                    categoryForecasts.data.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{item.category_name}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-slate-100">{item.total_historical_sales.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono text-indigo-600 dark:text-indigo-400 font-bold">{item.predicted_demand.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          <span className={`${item.expected_growth_percentage >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {item.expected_growth_percentage >= 0 ? '+' : ''}{item.expected_growth_percentage.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.forecast_period.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{new Date(item.generated_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-xs font-semibold">No category forecasts available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Dashboard Tab */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-5">
            {kpisLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 animate-pulse">
                    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-3" />
                    <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                  </div>
                ))
              : kpiCards.map((item) => (
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
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Top Predicted Products</h2>
              </div>
              <div className="p-4 h-80">
                {topProductsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProductsData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }} />
                      <Bar dataKey="predicted" radius={[4, 4, 4, 4]} barSize={16}>
                        {topProductsData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.85} />
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
                <TimelineIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Forecast Accuracy Trend</h2>
              </div>
              <div className="p-4 h-80">
                {accuracyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={accuracyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" />
                      <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }} />
                      <Legend />
                      <Line type="monotone" dataKey="historical" stroke="#ef4444" strokeWidth={2} name="Historical Sales" />
                      <Line type="monotone" dataKey="prediction" stroke="#4f46e5" strokeWidth={2} name="Prediction" />
                      <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2} name="Accuracy %" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                    <TimelineIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                    <span className="text-xs font-semibold">No accuracy data available</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Forecast;
