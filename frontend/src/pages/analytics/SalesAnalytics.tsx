import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import {
  getKPIDashboard,
  getRevenueTrend,
  getSalesTrend,
  getTopProducts,
  getTopCustomers,
  getPaymentMethods,
  getProducts,
  getCategories,
  exportAnalytics,
  type AnalyticsFilters,
  type RevenueTrendPoint,
  type SalesTrendPoint,
  type TopProductResponse,
  type TopCustomerResponse,
  type PaymentMethodBreakdown,
  type Product,
  type Category,
  type ExportRequest,
} from '../../api/analyticsApi';
import { getCustomers, type Customer } from '../../api/customerApi';
import { formatCurrency } from '../../utils/currency';
import {
  AttachMoney as MoneyIcon,
  ShoppingCart as CartIcon,
  ShoppingBag as BagIcon,
  TrendingUp as TrendingIcon,
  ShowChart as ChartIcon,
  Payment as PaymentIcon,
  People as PeopleIcon,
  FileDownload as ExportIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Receipt as ReceiptIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { Pagination } from '../../components/Pagination';

const INTERVALS = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
] as const;

const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: 'last_7_days' },
  { label: 'Last 30 Days', value: 'last_30_days' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
] as const;

const PAYMENT_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const inputClass =
  'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition-all';

const getDateRange = (preset: string): { date_from?: string; date_to?: string } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let date_from: string | undefined;
  let date_to: string = today.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      date_from = today.toISOString().split('T')[0];
      break;
    case 'last_7_days':
      date_from = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'last_30_days':
      date_from = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'this_month':
      date_from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      break;
    case 'last_month':
      date_from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      date_to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      break;
    default:
      break;
  }

  return { date_from, date_to };
};

type SortField = 'total_revenue' | 'total_quantity';
type SortDir = 'asc' | 'desc';

export const SalesAnalytics: React.FC = () => {
  const { user } = useAuth();

  const [interval, setInterval] = useState<string>('daily');
  const [datePreset, setDatePreset] = useState<string>('last_30_days');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [productSortField, setProductSortField] = useState<SortField>('total_revenue');
  const [productSortDir, setProductSortDir] = useState<SortDir>('desc');
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [topCustomersPage, setTopCustomersPage] = useState(1);
  const PAGE_SIZE = 10;

  const { data: rawCustomers } = useQuery({
    queryKey: ['sales-analytics', 'customers'],
    queryFn: () => getCustomers({ status: 'ACTIVE' }),
  });
  const customers = (rawCustomers || []) as Customer[];

  const { data: rawProducts } = useQuery({
    queryKey: ['sales-analytics', 'products'],
    queryFn: () => getProducts({ status: 'ACTIVE' }),
  });
  const products = (rawProducts || []) as Product[];

  const { data: rawCategories } = useQuery({
    queryKey: ['sales-analytics', 'categories'],
    queryFn: getCategories,
  });
  const categories = (rawCategories || []) as Category[];

  const dateRange = useMemo(() => {
    if (datePreset === 'custom') {
      return {
        date_from: customDateFrom || undefined,
        date_to: customDateTo || undefined,
      };
    }
    return getDateRange(datePreset);
  }, [datePreset, customDateFrom, customDateTo]);

  const dateError = useMemo(() => {
    if (datePreset === 'custom' && customDateFrom && customDateTo && customDateFrom > customDateTo) {
      return 'Start date cannot be after end date';
    }
    return null;
  }, [datePreset, customDateFrom, customDateTo]);

  const analyticsFilters: AnalyticsFilters = useMemo(() => ({
    ...filters,
    ...dateRange,
  }), [filters, dateRange]);

  const updateFilter = (key: keyof AnalyticsFilters, value: string | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const clearFilters = () => {
    setFilters({});
    setDatePreset('last_30_days');
    setCustomDateFrom('');
    setCustomDateTo('');
  };

  const hasActiveFilters = Object.values({ ...filters, ...dateRange }).some(
    (v) => v !== undefined && v !== ''
  );

  const { data: kpis, isLoading: kpisLoading, error: kpisError } = useQuery({
    queryKey: ['sales-analytics', 'kpis', analyticsFilters],
    queryFn: () => getKPIDashboard(analyticsFilters),
  });

  const { data: revenueTrendData, isLoading: revenueLoading } = useQuery({
    queryKey: ['sales-analytics', 'revenue-trend', interval, analyticsFilters],
    queryFn: () => getRevenueTrend(interval, analyticsFilters),
  });
  const revenueTrend = (revenueTrendData || []) as RevenueTrendPoint[];

  const { data: salesTrendData, isLoading: salesLoading } = useQuery({
    queryKey: ['sales-analytics', 'sales-trend', interval, analyticsFilters],
    queryFn: () => getSalesTrend(interval, analyticsFilters),
  });
  const salesTrend = (salesTrendData || []) as SalesTrendPoint[];

  const { data: topProductsData, isLoading: topProductsLoading } = useQuery({
    queryKey: ['sales-analytics', 'top-products', analyticsFilters, productSortField, productSortDir],
    queryFn: () => getTopProducts(10, analyticsFilters, 1, 10, productSortField, productSortDir),
  });
  const _topProducts = (topProductsData || []) as TopProductResponse[];

  const { data: topCustomersData, isLoading: topCustomersLoading } = useQuery({
    queryKey: ['sales-analytics', 'top-customers', analyticsFilters, topCustomersPage],
    queryFn: () => getTopCustomers(10, analyticsFilters, topCustomersPage, PAGE_SIZE),
  });
  const topCustomers = (topCustomersData?.items || []) as TopCustomerResponse[];
  const topCustomersTotal = topCustomersData?.total || 0;

  const { data: paymentMethodsData, isLoading: paymentMethodsLoading } = useQuery({
    queryKey: ['sales-analytics', 'payment-methods', analyticsFilters],
    queryFn: () => getPaymentMethods(analyticsFilters),
  });
  const paymentMethods = (paymentMethodsData || []) as PaymentMethodBreakdown[];

  const sortedTopProducts = useMemo(() => {
    const sorted = [...(topProductsData || [])];
    sorted.sort((a, b) => {
      const aVal = productSortField === 'total_revenue' ? a.total_revenue : a.total_quantity;
      const bVal = productSortField === 'total_revenue' ? b.total_revenue : b.total_quantity;
      if (productSortDir === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
    return sorted;
  }, [topProductsData, productSortField, productSortDir]);

  const toggleProductSort = (field: SortField) => {
    if (productSortField === field) {
      setProductSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setProductSortField(field);
      setProductSortDir('desc');
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getExportFilename = (reportType: string, exportType: string) => {
    const company = user?.company?.replace(/\s+/g, '_') || 'RetailPulse_Analytics';
    return `${company}_sales_analytics_report.${exportType}`;
  };

  const handleExportCSV = async (reportType: ExportRequest['report_type'] = 'kpis') => {
    setExportingType(`csv-${reportType}`);
    try {
      const blob = await exportAnalytics({ export_type: 'csv', report_type: reportType, filters: analyticsFilters });
      downloadBlob(blob, getExportFilename(reportType, 'csv'));
    } catch (err) {
      console.error('CSV Export Error:', err);
    } finally {
      setExportingType(null);
    }
  };

  const handleExportPDF = async (reportType: ExportRequest['report_type'] = 'kpis') => {
    setExportingType(`pdf-${reportType}`);
    try {
      const blob = await exportAnalytics({ export_type: 'pdf', report_type: reportType, filters: analyticsFilters });
      downloadBlob(blob, getExportFilename(reportType, 'pdf'));
    } catch (err) {
      console.error('PDF Export Error:', err);
    } finally {
      setExportingType(null);
    }
  };

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    return [
      { id: 'revenue', title: 'Total Revenue', value: formatCurrency(kpis.total_revenue || 0), icon: <MoneyIcon className="text-white" />, color: 'from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-900', border: 'border-indigo-100 dark:border-indigo-900/40', accent: 'bg-indigo-600', text: 'text-indigo-700 dark:text-indigo-300' },
      { id: 'orders', title: 'Total Orders', value: (kpis.total_orders || 0).toLocaleString(), icon: <CartIcon className="text-white" />, color: 'from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900', border: 'border-emerald-100 dark:border-emerald-900/40', accent: 'bg-emerald-600', text: 'text-emerald-700 dark:text-emerald-300' },
      { id: 'aov', title: 'Avg Order Value', value: formatCurrency(kpis.average_order_value || 0), icon: <TrendingIcon className="text-white" />, color: 'from-violet-50 to-white dark:from-violet-950/30 dark:to-slate-900', border: 'border-violet-100 dark:border-violet-900/40', accent: 'bg-violet-600', text: 'text-violet-700 dark:text-violet-300' },
      { id: 'items_sold', title: 'Total Items Sold', value: (kpis.total_products_sold || 0).toLocaleString(), icon: <BagIcon className="text-white" />, color: 'from-pink-50 to-white dark:from-pink-950/30 dark:to-slate-900', border: 'border-pink-100 dark:border-pink-900/40', accent: 'bg-pink-600', text: 'text-pink-700 dark:text-pink-300' },
      { id: 'discount', title: 'Total Discount', value: formatCurrency(kpis.total_discount || 0), icon: <ReceiptIcon className="text-white" />, color: 'from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900', border: 'border-amber-100 dark:border-amber-900/40', accent: 'bg-amber-600', text: 'text-amber-700 dark:text-amber-300' },
      { id: 'tax', title: 'Total Tax', value: formatCurrency(kpis.total_tax || 0), icon: <ChartIcon className="text-white" />, color: 'from-orange-50 to-white dark:from-orange-950/30 dark:to-slate-900', border: 'border-orange-100 dark:border-orange-900/40', accent: 'bg-orange-600', text: 'text-orange-700 dark:text-orange-300' },
    ];
  }, [kpis]);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header & Main Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            Sales Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center gap-2">
            Company: <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{user?.company}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative group">
            <button className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md shadow-indigo-600/20">
              <ExportIcon style={{ fontSize: 16 }} />
              <span>Export</span>
            </button>
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all p-2 space-y-1">
              <button onClick={() => handleExportCSV('kpis')} disabled={exportingType === 'csv'} className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <CsvIcon fontSize="small" className="text-emerald-500" /> Export KPI CSV
              </button>
              <button onClick={() => handleExportCSV('sales')} disabled={exportingType === 'csv'} className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <CsvIcon fontSize="small" className="text-emerald-500" /> Export Sales Trend CSV
              </button>
              <button onClick={() => handleExportCSV('top-products')} disabled={exportingType === 'csv'} className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <CsvIcon fontSize="small" className="text-emerald-500" /> Export Top Products CSV
              </button>
              <button onClick={() => handleExportCSV('top-customers')} disabled={exportingType === 'csv'} className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <CsvIcon fontSize="small" className="text-emerald-500" /> Export Top Customers CSV
              </button>
              <button onClick={() => handleExportCSV('payment-methods')} disabled={exportingType === 'csv'} className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <CsvIcon fontSize="small" className="text-emerald-500" /> Export Payment Methods CSV
              </button>
              <button onClick={() => handleExportPDF('kpis')} disabled={exportingType === 'pdf'} className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <PdfIcon fontSize="small" className="text-rose-500" /> Export KPI PDF
              </button>
              <button onClick={() => handleExportPDF('sales')} disabled={exportingType === 'pdf'} className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <PdfIcon fontSize="small" className="text-rose-500" /> Export Sales Trend PDF
              </button>
              <button onClick={() => handleExportPDF('top-products')} disabled={exportingType === 'pdf'} className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <PdfIcon fontSize="small" className="text-rose-500" /> Export Top Products PDF
              </button>
              <button onClick={() => handleExportPDF('top-customers')} disabled={exportingType === 'pdf'} className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <PdfIcon fontSize="small" className="text-rose-500" /> Export Top Customers PDF
              </button>
              <button onClick={() => handleExportPDF('payment-methods')} disabled={exportingType === 'pdf'} className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <PdfIcon fontSize="small" className="text-rose-500" /> Export Payment Methods PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 md:p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <FilterListIcon fontSize="small" className="text-indigo-600 dark:text-indigo-400" />
            Filters
          </div>

          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            className={`${inputClass} lg:w-40`}
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
            <option value="custom">Custom Range</option>
          </select>

          {datePreset === 'custom' && (
            <>
              <input
                type="date"
                className={`text-xs border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${dateError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-200 dark:border-slate-700'}`}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                value={customDateFrom}
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                className={`text-xs border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${dateError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-200 dark:border-slate-700'}`}
                onChange={(e) => setCustomDateTo(e.target.value)}
                value={customDateTo}
              />
              {dateError && <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">{dateError}</span>}
            </>
          )}

          <select
            value={filters.sales_channel || ''}
            onChange={(e) => updateFilter('sales_channel', e.target.value)}
            className={`${inputClass} lg:w-36`}
          >
            <option value="">All Channels</option>
            <option value="Retail Store">Retail Store</option>
            <option value="Online Store">Online Store</option>
            <option value="Marketplace">Marketplace</option>
          </select>

          <select
            value={filters.payment_method || ''}
            onChange={(e) => updateFilter('payment_method', e.target.value)}
            className={`${inputClass} lg:w-36`}
          >
            <option value="">All Payments</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="UPI">UPI</option>
            <option value="Bank Transfer">Bank Transfer</option>
          </select>

          <select
            value={filters.product_id || ''}
            onChange={(e) => updateFilter('product_id', e.target.value)}
            className={`${inputClass} lg:w-44`}
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={filters.category_id || ''}
            onChange={(e) => updateFilter('category_id', e.target.value)}
            className={`${inputClass} lg:w-40`}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={filters.customer_id || ''}
            onChange={(e) => updateFilter('customer_id', e.target.value)}
            className={`${inputClass} lg:w-44`}
          >
            <option value="">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ClearIcon style={{ fontSize: 14 }} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-5">
        {kpisLoading
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

      {kpisError && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-400">
          Failed to load KPI data. Please try refreshing the page.
        </div>
      )}

      {/* Visualizations Grid 1: Revenue Trend & Sales vs Orders */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        {/* Sales Overview Chart */}
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
                  onClick={() => setInterval(int.value)}
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
            {revenueLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-lg h-full min-h-[180px]" />
              </div>
            ) : revenueTrend && revenueTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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

        {/* Sales vs Orders Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
            <CartIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Sales vs Orders</h2>
          </div>
          <div className="p-4 h-72">
            {salesLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-lg h-full min-h-[180px]" />
              </div>
            ) : salesTrend && salesTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
                    {salesTrend.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill="#6366f1" fillOpacity={0.85} />
                    ))}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="quantity" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} />
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
      </div>

      {/* Top Performing Products */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-2">
            <BagIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Top Performing Products</h2>
          </div>
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => toggleProductSort('total_revenue')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                productSortField === 'total_revenue'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Revenue
              {productSortField === 'total_revenue' && (productSortDir === 'asc' ? <ArrowUpIcon style={{ fontSize: 12 }} /> : <ArrowDownIcon style={{ fontSize: 12 }} />)}
            </button>
            <button
              onClick={() => toggleProductSort('total_quantity')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                productSortField === 'total_quantity'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Units Sold
              {productSortField === 'total_quantity' && (productSortDir === 'asc' ? <ArrowUpIcon style={{ fontSize: 12 }} /> : <ArrowDownIcon style={{ fontSize: 12 }} />)}
            </button>
          </div>
        </div>
        <div className="p-4 overflow-x-auto">
          {topProductsLoading ? (
            <div className="animate-pulse space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              ))}
            </div>
          ) : sortedTopProducts && sortedTopProducts.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Units Sold</th>
                  <th className="p-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {sortedTopProducts.map((p) => (
                  <tr key={p.product_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{p.product_name}</td>
                    <td className="p-3 font-mono text-slate-500">{p.sku}</td>
                    <td className="p-3">{p.category_name || 'Uncategorized'}</td>
                    <td className="p-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{p.total_quantity.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(p.total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
              <BagIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
              <span className="text-xs font-semibold">No top products data available</span>
            </div>
          )}
        </div>
      </div>

      {/* Customer Revenue Analysis & Payment Method Analysis */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        {/* Customer Revenue Analysis */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
            <PeopleIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Top Customers by Revenue</h2>
          </div>
          <div className="p-4 overflow-x-auto">
            {topCustomersLoading ? (
              <div className="animate-pulse space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                ))}
              </div>
            ) : topCustomers && topCustomers.length > 0 ? (
              <>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3 text-center">Orders</th>
                      <th className="p-3 text-right">Total Spend</th>
                      <th className="p-3 text-right">Avg Order Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {topCustomers.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 text-slate-500 font-mono">{idx + 1 + (topCustomersPage - 1) * PAGE_SIZE}</td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{c.first_name} {c.last_name}</div>
                          <div className="text-[10px] text-slate-400">{c.email || '—'}</div>
                        </td>
                        <td className="p-3 text-center font-bold">{c.total_purchases}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(c.total_spent)}</td>
                        <td className="p-3 text-right font-mono text-indigo-600 dark:text-indigo-400">{formatCurrency(c.average_order_value || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination page={topCustomersPage} pageSize={PAGE_SIZE} total={topCustomersTotal} onPageChange={setTopCustomersPage} />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                <PeopleIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                <span className="text-xs font-semibold">No customer data available</span>
              </div>
            )}
          </div>
        </div>

        {/* Payment Method Analysis */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
            <PaymentIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Payment Method Analysis</h2>
          </div>
          <div className="p-4 h-80">
            {paymentMethodsLoading ? (
              <div className="animate-pulse flex items-center justify-center h-full">
                <div className="w-full h-full bg-slate-200 dark:bg-slate-800 rounded-lg" />
              </div>
            ) : paymentMethods && paymentMethods.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethods}
                    dataKey="total_revenue"
                    nameKey="payment_method"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    paddingAngle={4}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {paymentMethods.map((_entry, index) => (
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
      </div>
    </div>
  );
};

export default SalesAnalytics;
