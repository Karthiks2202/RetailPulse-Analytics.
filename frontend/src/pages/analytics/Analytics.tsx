import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  getKPIDashboard,
  getRevenueTrend,
  getSalesTrend,
  getTopProducts,
  getTopCategories,
  getTopCustomers,
  getPaymentMethods,
  getSalesChannels,
  getStockStatus,
  getInventoryDistribution,
  getLowStockProducts,
  getOutOfStockProducts,
  getInventoryValue,
  getBrands,
  getProducts,
  getCategories,
  getDrillDownTransactions,
  getDrillDownProducts,
  getDrillDownCategoryProducts,
  getDrillDownProductTransactions,
  refreshAnalytics,
  logAnalyticsEvent,
  exportAnalytics,
  type AnalyticsFilters,
  type Product,
  type Category,
  type RevenueTrendPoint,
  type SalesTrendPoint,
  type TopProductResponse,
  type TopCategoryResponse,
  type PaymentMethodBreakdown,
  type SalesChannelBreakdown,
  type StockStatusSummary,
  type InventoryDistributionCategory,
  type LowStockProductResponse,
  type OutOfStockProductResponse,
  type InventoryValueByCategory,
  type DrillDownTransactionResponse,
  type DrillDownProductResponse,
  type DrillDownCategoryProductResponse,
  type DrillDownProductTransactionResponse,
  type ExportRequest,
} from '../../api/analyticsApi';
import {
  getCustomerGrowth,
  getRevenueByCustomerType,
  getLocationDistribution,
  getSpendingDistribution,
  getPurchaseFrequencyDistribution,
  getCustomerSegmentation,
  getMonthlyCustomerAcquisition,
  getNewVsReturning,
  getRecentCustomers,
  getCustomerRevenueContribution,
  getCustomers,
  type Customer,
  type CustomerGrowthPoint,
  type RevenueByTypePoint,
  type LocationDistributionPoint,
  type SpendingDistributionResponse,
  type PurchaseFrequencyPoint,
  type CustomerSegmentResponse,
  type MonthlyAcquisitionPoint,
  type TopCustomerResponse,
} from '../../api/customerApi';
import { formatCurrency } from '../../utils/currency';
import {
  AttachMoney as MoneyIcon,
  ShoppingCart as CartIcon,
  ShoppingBag as BagIcon,
  TrendingUp as TrendingIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  RemoveShoppingCart as OutOfStockIcon,
  Category as CategoryIcon,
  ShowChart as ChartIcon,
  Storefront as StoreIcon,
  Payment as PaymentIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  FileDownload as ExportIcon,
  Close as CloseIcon,
  Receipt as ReceiptIcon,
  ChevronRight as ChevronRightIcon,
  FilterList as FilterListIcon,
  Autorenew as AutoRefreshIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
  People as PeopleIcon,
  BarChart as MuiBarChartIcon,
} from '@mui/icons-material';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Pagination } from '../../components/Pagination';

const INTERVALS = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
] as const;

const SALES_CHANNELS = [
  { value: 'Retail Store', label: 'Retail Store' },
  { value: 'Online Store', label: 'Online Store' },
  { value: 'Marketplace', label: 'Marketplace' },
] as const;

const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Card', label: 'Card' },
  { value: 'UPI', label: 'UPI' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
] as const;

const PAGE_SIZE = 10;

const KPI_COLORS = [
  { bg: 'from-indigo-50 to-white', darkBg: 'dark:from-indigo-950/30 dark:to-slate-900', border: 'border-indigo-100 dark:border-indigo-900/40', accent: 'bg-indigo-600', text: 'text-indigo-700 dark:text-indigo-300', sub: 'text-indigo-500 dark:text-indigo-400' },
  { bg: 'from-emerald-50 to-white', darkBg: 'dark:from-emerald-950/30 dark:to-slate-900', border: 'border-emerald-100 dark:border-emerald-900/40', accent: 'bg-emerald-600', text: 'text-emerald-700 dark:text-emerald-300', sub: 'text-emerald-500 dark:text-emerald-400' },
  { bg: 'from-violet-50 to-white', darkBg: 'dark:from-violet-950/30 dark:to-slate-900', border: 'border-violet-100 dark:border-violet-900/40', accent: 'bg-violet-600', text: 'text-violet-700 dark:text-violet-300', sub: 'text-violet-500 dark:text-violet-400' },
  { bg: 'from-pink-50 to-white', darkBg: 'dark:from-pink-950/30 dark:to-slate-900', border: 'border-pink-100 dark:border-pink-900/40', accent: 'bg-pink-600', text: 'text-pink-700 dark:text-pink-300', sub: 'text-pink-500 dark:text-pink-400' },
  { bg: 'from-amber-50 to-white', darkBg: 'dark:from-amber-950/30 dark:to-slate-900', border: 'border-amber-100 dark:border-amber-900/40', accent: 'bg-amber-600', text: 'text-amber-700 dark:text-amber-300', sub: 'text-amber-500 dark:text-amber-400' },
  { bg: 'from-orange-50 to-white', darkBg: 'dark:from-orange-950/30 dark:to-slate-900', border: 'border-orange-100 dark:border-orange-900/40', accent: 'bg-orange-600', text: 'text-orange-700 dark:text-orange-300', sub: 'text-orange-500 dark:text-orange-400' },
  { bg: 'from-red-50 to-white', darkBg: 'dark:from-red-950/30 dark:to-slate-900', border: 'border-red-100 dark:border-red-900/40', accent: 'bg-red-600', text: 'text-red-700 dark:text-red-300', sub: 'text-red-500 dark:text-red-400' },
  { bg: 'from-sky-50 to-white', darkBg: 'dark:from-sky-950/30 dark:to-slate-900', border: 'border-sky-100 dark:border-sky-900/40', accent: 'bg-sky-600', text: 'text-sky-700 dark:text-sky-300', sub: 'text-sky-500 dark:text-sky-400' },
];

const inputClass =
  'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition-all';

export const Analytics: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  const [interval, setInterval] = useState<string>('daily');
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [, setExportingType] = useState<string | null>(null);
  const [topCustomersPage, setTopCustomersPage] = useState(1);

  // Drill-down Modals state
  const [activeDrillDown, setActiveDrillDown] = useState<'transactions' | 'products' | 'low_stock' | 'out_of_stock' | 'categories' | null>(null);
  const [selectedCategoryForDrill, setSelectedCategoryForDrill] = useState<{ id: string; name: string } | null>(null);
  const [selectedProductForDrill, setSelectedProductForDrill] = useState<{ id: string; name: string } | null>(null);
  const [drillSearchQuery, setDrillSearchQuery] = useState<string>('');

  // Log Dashboard View on mount
  useEffect(() => {
    logAnalyticsEvent({ action: 'Dashboard Viewed' }).catch(() => {});
  }, []);

  // Handle Auto-Refresh interval
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const timer = window.setInterval(() => {
      handleManualRefresh(true);
    }, autoRefreshInterval);
    return () => clearInterval(timer);
  }, [autoRefreshInterval]);

const queryOptions: { refetchInterval: number | false } = {
  refetchInterval: autoRefreshInterval > 0 ? autoRefreshInterval : false,
};

  const { data: rawProducts } = useQuery({
    queryKey: ['analytics', 'products'],
    queryFn: () => getProducts({ status: 'ACTIVE' }),
  });
  const products = (rawProducts || []) as Product[];

  const { data: rawCategories } = useQuery({
    queryKey: ['analytics', 'categories'],
    queryFn: getCategories,
  });
  const categories = (rawCategories || []) as Category[];

  const { data: rawBrands } = useQuery({
    queryKey: ['analytics', 'brands'],
    queryFn: getBrands,
  });
  const brands = (rawBrands || []) as string[];

  const { data: rawCustomers } = useQuery({
    queryKey: ['analytics', 'customers'],
    queryFn: () => getCustomers({ status: 'ACTIVE' }),
  });
  const customers = (rawCustomers || []) as Customer[];

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['analytics', 'kpis', filters],
    queryFn: () => getKPIDashboard(filters),
    ...queryOptions,
  });

  const { data: revenueTrendData, isLoading: revenueLoading } = useQuery({
    queryKey: ['analytics', 'revenue-trend', interval, filters],
    queryFn: () => getRevenueTrend(interval, filters),
    ...queryOptions,
  });
  const revenueTrend = (revenueTrendData || []) as RevenueTrendPoint[];

  const { data: salesTrendData, isLoading: salesLoading } = useQuery({
    queryKey: ['analytics', 'sales-trend', interval, filters],
    queryFn: () => getSalesTrend(interval, filters),
    ...queryOptions,
  });
  const salesTrend = (salesTrendData || []) as SalesTrendPoint[];

  const { data: topProductsData, isLoading: topProductsLoading } = useQuery({
    queryKey: ['analytics', 'top-products', filters],
    queryFn: () => getTopProducts(10, filters),
    ...queryOptions,
  });
  const topProducts = (topProductsData?.items || []) as TopProductResponse[];

  const { data: topCategoriesData, isLoading: topCategoriesLoading } = useQuery({
    queryKey: ['analytics', 'top-categories', filters],
    queryFn: () => getTopCategories(10, filters),
    ...queryOptions,
  });
  const topCategories = (topCategoriesData?.items || []) as TopCategoryResponse[];

  const { data: paymentMethodsData, isLoading: paymentMethodsLoading } = useQuery({
    queryKey: ['analytics', 'payment-methods', filters],
    queryFn: () => getPaymentMethods(filters),
    ...queryOptions,
  });
  const paymentMethods = (paymentMethodsData || []) as PaymentMethodBreakdown[];

  const { data: salesChannelsData, isLoading: salesChannelsLoading } = useQuery({
    queryKey: ['analytics', 'sales-channels', filters],
    queryFn: () => getSalesChannels(filters),
    ...queryOptions,
  });
  const salesChannels = (salesChannelsData || []) as SalesChannelBreakdown[];

  const { data: stockStatusData, isLoading: stockStatusLoading } = useQuery({
    queryKey: ['analytics', 'stock-status', filters],
    queryFn: () => getStockStatus(filters),
    ...queryOptions,
  });
  const stockStatus = (stockStatusData || []) as StockStatusSummary[];

  const { data: inventoryDistData, isLoading: inventoryDistLoading } = useQuery({
    queryKey: ['analytics', 'inventory-distribution', filters],
    queryFn: () => getInventoryDistribution(filters),
    ...queryOptions,
  });
  const inventoryDist = (inventoryDistData || []) as InventoryDistributionCategory[];

  const { data: lowStockProductsData, isLoading: lowStockLoading } = useQuery({
    queryKey: ['analytics', 'low-stock', filters],
    queryFn: () => getLowStockProducts(20, filters),
    ...queryOptions,
  });
  const lowStockProducts = (lowStockProductsData || []) as LowStockProductResponse[];

  const { data: outOfStockProductsData, isLoading: outOfStockLoading } = useQuery({
    queryKey: ['analytics', 'out-of-stock', filters],
    queryFn: () => getOutOfStockProducts(50, filters),
    ...queryOptions,
  });
  const outOfStockProducts = (outOfStockProductsData || []) as OutOfStockProductResponse[];

  const { data: inventoryValueData } = useQuery({
    queryKey: ['analytics', 'inventory-value', filters],
    queryFn: () => getInventoryValue(filters),
    ...queryOptions,
  });
  const inventoryValue = (inventoryValueData || []) as InventoryValueByCategory[];

  const { data: customerGrowthData, isLoading: customerGrowthLoading } = useQuery({
    queryKey: ['analytics', 'customer-growth'],
    queryFn: () => getCustomerGrowth(12),
    ...queryOptions,
  });
  const customerGrowth = (customerGrowthData || []) as CustomerGrowthPoint[];

  const { data: revenueByTypeData, isLoading: revenueByTypeLoading } = useQuery({
    queryKey: ['analytics', 'revenue-by-type'],
    queryFn: getRevenueByCustomerType,
    ...queryOptions,
  });
  const revenueByType = (revenueByTypeData || []) as RevenueByTypePoint[];

  const { data: locationDistData, isLoading: locationDistLoading } = useQuery({
    queryKey: ['analytics', 'location-distribution'],
    queryFn: getLocationDistribution,
    ...queryOptions,
  });
  const locationDist = (locationDistData || []) as LocationDistributionPoint[];

  const { data: spendingDistData, isLoading: spendingDistLoading } = useQuery({
    queryKey: ['analytics', 'spending-distribution'],
    queryFn: getSpendingDistribution,
    ...queryOptions,
  });
  const spendingDist = (spendingDistData || null) as SpendingDistributionResponse | null;

  const { data: purchaseFreqData, isLoading: purchaseFreqLoading } = useQuery({
    queryKey: ['analytics', 'purchase-frequency'],
    queryFn: getPurchaseFrequencyDistribution,
    ...queryOptions,
  });
  const purchaseFreq = (purchaseFreqData || []) as PurchaseFrequencyPoint[];

  const { data: segmentationData, isLoading: segmentationLoading } = useQuery({
    queryKey: ['analytics', 'segmentation'],
    queryFn: getCustomerSegmentation,
    ...queryOptions,
  });
  const segmentation = (segmentationData || null) as CustomerSegmentResponse | null;

  const { data: monthlyAcquisitionData, isLoading: monthlyAcquisitionLoading } = useQuery({
    queryKey: ['analytics', 'monthly-acquisition'],
    queryFn: () => getMonthlyCustomerAcquisition(12),
    ...queryOptions,
  });
  const monthlyAcquisition = (monthlyAcquisitionData || []) as MonthlyAcquisitionPoint[];

  const { data: topCustomersData, isLoading: topCustomersLoading } = useQuery({
    queryKey: ['analytics', 'top-customers', filters, topCustomersPage],
    queryFn: () => getTopCustomers(10, filters, topCustomersPage, PAGE_SIZE),
    ...queryOptions,
  });
  const topCustomers = (topCustomersData?.items || []) as TopCustomerResponse[];
  const topCustomersTotal = topCustomersData?.total || 0;

  const { data: recentCustomersData, isLoading: recentCustomersLoading } = useQuery({
    queryKey: ['analytics', 'recent-customers'],
    queryFn: () => getRecentCustomers(10),
    ...queryOptions,
  });
  const recentCustomers = (recentCustomersData || []) as Array<{ id: string; first_name: string; last_name: string; email: string | null; phone: string | null; customer_type: string; status: string; total_purchases: number; total_spent: number; last_purchase_date: string | null; customer_since: string; created_at: string; }>;

  const { data: revenueContributionData, isLoading: revenueContributionLoading } = useQuery({
    queryKey: ['analytics', 'revenue-contribution'],
    queryFn: () => getCustomerRevenueContribution(10),
    ...queryOptions,
  });
  const revenueContribution = (revenueContributionData || []) as Array<{ id: string; first_name: string; last_name: string; email: string | null; revenue: number; }>;

  // Queries for drill-down details
  const { data: drillTransactionsData, isLoading: drillTransactionsLoading } = useQuery({
    queryKey: ['analytics', 'drill-transactions', filters],
    queryFn: () => getDrillDownTransactions(filters),
    enabled: activeDrillDown === 'transactions',
  });
  const drillTransactions = (drillTransactionsData || []) as DrillDownTransactionResponse[];

  const { data: drillProductsData, isLoading: drillProductsLoading } = useQuery({
    queryKey: ['analytics', 'drill-products', filters],
    queryFn: () => getDrillDownProducts(filters),
    enabled: activeDrillDown === 'products',
  });
  const drillProducts = (drillProductsData || []) as DrillDownProductResponse[];

  const { data: drillCategoryProductsData, isLoading: drillCategoryProductsLoading } = useQuery({
    queryKey: ['analytics', 'drill-category-products', selectedCategoryForDrill?.id, filters],
    queryFn: () => (selectedCategoryForDrill ? getDrillDownCategoryProducts(selectedCategoryForDrill.id, filters) : []),
    enabled: !!selectedCategoryForDrill,
  });
  const drillCategoryProducts = (drillCategoryProductsData || []) as DrillDownCategoryProductResponse[];

  const { data: drillProductTransactionsData, isLoading: drillProductTransactionsLoading } = useQuery({
    queryKey: ['analytics', 'drill-product-transactions', selectedProductForDrill?.id, filters],
    queryFn: () => (selectedProductForDrill ? getDrillDownProductTransactions(selectedProductForDrill.id, filters) : []),
    enabled: !!selectedProductForDrill,
  });
  const drillProductTransactions = (drillProductTransactionsData || []) as DrillDownProductTransactionResponse[];

  const updateFilter = (key: keyof AnalyticsFilters, value: string | undefined) => {
    const updated = { ...filters, [key]: value || undefined };
    setFilters(updated);
    logAnalyticsEvent({
      action: 'Dashboard Filters Applied',
      details: JSON.stringify(updated),
    }).catch(() => {});
  };

  const clearFilters = () => {
    setFilters({});
    logAnalyticsEvent({ action: 'Dashboard Filters Applied', details: 'Cleared filters' }).catch(() => {});
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== '');

  const handleManualRefresh = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      await refreshAnalytics();
      await queryClient.invalidateQueries({ queryKey: ['analytics'] });
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      if (!silent) setIsRefreshing(false);
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
    const company = user?.company?.replace(/\s+/g, '_') || 'RetailPulse';
    const type = reportType.replace(/-/g, '_');
    return `${company}_${type}_report.${exportType}`;
  };

  const handleExportCSV = async (reportType: ExportRequest['report_type']) => {
    setExportingType(`csv-${reportType}`);
    try {
      const blob = await exportAnalytics({ export_type: 'csv', report_type: reportType, filters });
      downloadBlob(blob, getExportFilename(reportType, 'csv'));
      showNotification('CSV report exported successfully', 'success');
    } catch (err) {
      console.error('CSV Export Error:', err);
      showNotification('Failed to export CSV report. Please try again.', 'error');
    } finally {
      setExportingType(null);
    }
  };

  const handleExportPDF = async (reportType: ExportRequest['report_type']) => {
    setExportingType(`pdf-${reportType}`);
    try {
      const blob = await exportAnalytics({ export_type: 'pdf', report_type: reportType, filters });
      downloadBlob(blob, getExportFilename(reportType, 'pdf'));
      showNotification('PDF report exported successfully', 'success');
    } catch (err) {
      console.error('PDF Export Error:', err);
      showNotification('Failed to export PDF report. Please try again.', 'error');
    } finally {
      setExportingType(null);
    }
  };

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    return [
      { id: 'revenue', title: 'Total Revenue', value: formatCurrency(kpis.total_revenue || 0), icon: <MoneyIcon className="text-white" />, color: KPI_COLORS[0], drillType: 'transactions' as const },
      { id: 'orders', title: 'Total Orders', value: (kpis.total_orders || 0).toLocaleString(), icon: <CartIcon className="text-white" />, color: KPI_COLORS[1], drillType: 'transactions' as const },
      { id: 'products_sold', title: 'Products Sold', value: (kpis.total_products_sold || 0).toLocaleString(), icon: <BagIcon className="text-white" />, color: KPI_COLORS[2], drillType: 'products' as const },
      { id: 'aov', title: 'Avg Order Value', value: formatCurrency(kpis.average_order_value || 0), icon: <TrendingIcon className="text-white" />, color: KPI_COLORS[3], drillType: 'transactions' as const },
      { id: 'inventory_value', title: 'Inventory Value', value: formatCurrency(kpis.total_inventory_value || 0), icon: <InventoryIcon className="text-white" />, color: KPI_COLORS[4], drillType: 'products' as const },
      { id: 'low_stock', title: 'Low Stock', value: (kpis.low_stock_products || 0).toLocaleString(), icon: <WarningIcon className="text-white" />, color: KPI_COLORS[5], drillType: 'low_stock' as const },
      { id: 'out_of_stock', title: 'Out of Stock', value: (kpis.out_of_stock_products || 0).toLocaleString(), icon: <OutOfStockIcon className="text-white" />, color: KPI_COLORS[6], drillType: 'out_of_stock' as const },
      { id: 'categories', title: 'Categories', value: (kpis.total_categories || 0).toLocaleString(), icon: <CategoryIcon className="text-white" />, color: KPI_COLORS[7], drillType: 'categories' as const },
    ];
  }, [kpis]);

  const paymentColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const channelColors = ['#4f46e5', '#10b981', '#f59e0b'];
  const stockColors: Record<string, string> = {
    IN_STOCK: '#10b981',
    LOW_STOCK: '#f59e0b',
    OUT_OF_STOCK: '#ef4444',
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header & Main Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            Retail Analytics Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center gap-2">
            Company: <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{user?.company}</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-xs text-slate-400">Isolated & Audit Logged</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Auto Refresh Select */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 shadow-sm">
            <AutoRefreshIcon className={`text-slate-400 ${autoRefreshInterval > 0 ? 'animate-spin text-indigo-500' : ''}`} style={{ fontSize: 16 }} />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Auto:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-indigo-600 dark:text-indigo-400 outline-none cursor-pointer"
            >
              <option value={0}>Off</option>
              <option value={30000}>30s</option>
              <option value={60000}>60s</option>
            </select>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={() => handleManualRefresh()}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshIcon className={isRefreshing ? 'animate-spin text-indigo-600' : ''} style={{ fontSize: 16 }} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {/* Export Dropdown Group */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md shadow-indigo-600/20">
              <ExportIcon style={{ fontSize: 16 }} />
              <span>Export Report</span>
            </button>
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all p-2 space-y-1">
              <div className="px-2 py-1 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">CSV Reports</div>
              <button onClick={() => handleExportCSV('kpis')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5"><CsvIcon fontSize="small" className="text-emerald-500" /> KPI Dashboard</span>
                <span className="text-[10px] text-slate-400">CSV</span>
              </button>
              <button onClick={() => handleExportCSV('sales')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5"><CsvIcon fontSize="small" className="text-emerald-500" /> Sales Analytics</span>
                <span className="text-[10px] text-slate-400">CSV</span>
              </button>
              <button onClick={() => handleExportCSV('inventory')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5"><CsvIcon fontSize="small" className="text-emerald-500" /> Inventory Summary</span>
                <span className="text-[10px] text-slate-400">CSV</span>
              </button>
              <button onClick={() => handleExportCSV('transactions')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5"><CsvIcon fontSize="small" className="text-emerald-500" /> Sales Transactions</span>
                <span className="text-[10px] text-slate-400">CSV</span>
              </button>

              <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
              <div className="px-2 py-1 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">PDF Reports</div>
              <button onClick={() => handleExportPDF('kpis')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5"><PdfIcon fontSize="small" className="text-rose-500" /> KPI Dashboard</span>
                <span className="text-[10px] text-slate-400">PDF</span>
              </button>
              <button onClick={() => handleExportPDF('sales')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5"><PdfIcon fontSize="small" className="text-rose-500" /> Sales Analytics</span>
                <span className="text-[10px] text-slate-400">PDF</span>
              </button>
              <button onClick={() => handleExportPDF('inventory')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5"><PdfIcon fontSize="small" className="text-rose-500" /> Inventory Summary</span>
                <span className="text-[10px] text-slate-400">PDF</span>
              </button>
              <button onClick={() => handleExportPDF('transactions')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5"><PdfIcon fontSize="small" className="text-rose-500" /> Sales Transactions</span>
                <span className="text-[10px] text-slate-400">PDF</span>
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
          <input
            type="date"
            className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={(e) => updateFilter('date_from', e.target.value)}
            value={filters.date_from || ''}
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={(e) => updateFilter('date_to', e.target.value)}
            value={filters.date_to || ''}
          />
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
            value={filters.brand || ''}
            onChange={(e) => updateFilter('brand', e.target.value)}
            className={`${inputClass} lg:w-36`}
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            value={filters.sales_channel || ''}
            onChange={(e) => updateFilter('sales_channel', e.target.value)}
            className={`${inputClass} lg:w-36`}
          >
            <option value="">All Channels</option>
            {SALES_CHANNELS.map((ch) => (
              <option key={ch.value} value={ch.value}>{ch.label}</option>
            ))}
          </select>
          <select
            value={filters.payment_method || ''}
            onChange={(e) => updateFilter('payment_method', e.target.value)}
            className={`${inputClass} lg:w-36`}
          >
            <option value="">All Payments</option>
            {PAYMENT_METHODS.map((pm) => (
              <option key={pm.value} value={pm.value}>{pm.label}</option>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        {kpisLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-5 bg-white dark:bg-slate-900 animate-pulse">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-3" />
                <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-1" />
                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))
          : kpiCards.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setActiveDrillDown(item.drillType);
                  setDrillSearchQuery('');
                }}
                className={`relative overflow-hidden rounded-2xl p-4 md:p-5 border shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group bg-gradient-to-br ${item.color.bg} ${item.color.darkBg} ${item.color.border}`}
              >
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${item.color.accent}`} />
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-tight">{item.title}</span>
                  <div className={`h-8 w-8 md:h-9 md:w-9 rounded-xl flex items-center justify-center shadow-md shrink-0 transition-transform group-hover:scale-110 ${item.color.accent}`}>
                    {item.icon}
                  </div>
                </div>
                <div className={`text-2xl md:text-3xl font-extrabold tracking-tight mb-1 ${item.color.text}`}>{item.value}</div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>Click to drill down</span>
                  <ChevronRightIcon style={{ fontSize: 14 }} className="group-hover:translate-x-1 transition-transform text-indigo-500" />
                </div>
              </div>
            ))}
      </div>

      {/* Visualizations Grid 1: Revenue Trend & Sales Volume Trend */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center gap-2">
              <ChartIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Revenue Trend</h2>
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
                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
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
                  <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3.5} fillOpacity={1} fill="url(#revGradient)" />
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

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
            <TrendingIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Sales Volume Trend</h2>
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
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }}
                    itemStyle={{ color: '#818cf8' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="sales" radius={[4, 4, 0, 0]} barSize={24}>
                    {salesTrend.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill="#6366f1" fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                <ReceiptIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                <span className="text-xs font-semibold">No sales volume data available</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visualizations Grid 2: Top Products & Top Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center gap-2">
              <BagIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Top 10 Best Selling Products</h2>
            </div>
            <span className="text-[11px] text-slate-400">Click bar for product transactions</span>
          </div>
          <div className="p-4 h-80">
            {topProductsLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-lg h-full min-h-[200px]" />
              </div>
            ) : topProducts && topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topProducts}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  onClick={(state: any) => {
                    if (state && state.activePayload && state.activePayload.length > 0) {
                      const item = state.activePayload[0].payload;
                      if (item && item.product_id) {
                        setSelectedProductForDrill({ id: item.product_id, name: item.product_name });
                      }
                    }
                  }}
                >
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="product_name" width={120} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }}
                    itemStyle={{ color: '#818cf8' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="total_quantity" radius={[4, 4, 4, 4]} barSize={16} className="cursor-pointer">
                    {topProducts.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={paymentColors[index % paymentColors.length]} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                <BagIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                <span className="text-xs font-semibold">No top products data</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center gap-2">
              <CategoryIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Top Performing Categories</h2>
            </div>
            <span className="text-[11px] text-slate-400">Click bar for category products</span>
          </div>
          <div className="p-4 h-80">
            {topCategoriesLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-lg h-full min-h-[200px]" />
              </div>
            ) : topCategories && topCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topCategories}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  onClick={(state: any) => {
                    if (state && state.activePayload && state.activePayload.length > 0) {
                      const item = state.activePayload[0].payload;
                      if (item && item.category_id) {
                        setSelectedCategoryForDrill({ id: item.category_id, name: item.category_name });
                      }
                    }
                  }}
                >
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="category_name" width={120} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }}
                    itemStyle={{ color: '#818cf8' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="total_quantity" radius={[4, 4, 4, 4]} barSize={16} className="cursor-pointer">
                    {topCategories.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={channelColors[index % channelColors.length]} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                <CategoryIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                <span className="text-xs font-semibold">No category data</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Breakdown Grid: Payment Method & Sales Channel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
            <PaymentIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Sales by Payment Method</h2>
          </div>
          <div className="p-6 space-y-5">
            {paymentMethodsLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="space-y-3">
                  <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-full" />
                  <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-full" />
                  <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-full" />
                </div>
              </div>
            ) : paymentMethods && paymentMethods.length > 0 ? (
              paymentMethods.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <span>{item.payment_method}</span>
                    <span className="font-mono">{formatCurrency(item.total_revenue)} ({item.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(item.percentage, 100)}%`, backgroundColor: paymentColors[idx % paymentColors.length] }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400 text-center py-8">No payment method breakdown available</div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
            <StoreIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Sales by Sales Channel</h2>
          </div>
          <div className="p-6 space-y-5">
            {salesChannelsLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="space-y-3">
                  <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-full" />
                  <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-full" />
                  <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-full" />
                </div>
              </div>
            ) : salesChannels && salesChannels.length > 0 ? (
              salesChannels.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <span>{item.sales_channel}</span>
                    <span className="font-mono">{formatCurrency(item.total_revenue)} ({item.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(item.percentage, 100)}%`, backgroundColor: channelColors[idx % channelColors.length] }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400 text-center py-8">No sales channel breakdown available</div>
            )}
          </div>
        </div>
      </div>

      {/* Inventory Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
            <WarningIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Stock Status Summary</h2>
          </div>
          <div className="p-4 h-64">
            {stockStatusLoading ? (
              <div className="animate-pulse flex items-center justify-center">
                <div className="w-full h-full bg-slate-200 dark:bg-slate-800 rounded-lg" />
              </div>
            ) : stockStatus && stockStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockStatus}
                    dataKey="product_count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={65}
                    paddingAngle={3}
                    label={({ name, percent }) => `${(name || '').replace(/_/g, ' ')}: ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {stockStatus.map((entry) => (
                      <Cell key={entry.status} fill={stockColors[entry.status] || '#6366f1'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }}
                    itemStyle={{ color: '#818cf8' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">No stock status data available</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center gap-2">
              <InventoryIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Inventory Distribution by Category</h2>
            </div>
            <span className="text-[11px] text-slate-400">Click category bar for product items</span>
          </div>
          <div className="p-4 h-64">
            {inventoryDistLoading ? (
              <div className="animate-pulse flex items-center justify-center">
                <div className="w-full h-full bg-slate-200 dark:bg-slate-800 rounded-lg" />
              </div>
            ) : inventoryDist && inventoryDist.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={inventoryDist}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  onClick={(state: any) => {
                    if (state && state.activePayload && state.activePayload.length > 0) {
                      const item = state.activePayload[0].payload;
                      if (item && item.category_id) {
                        setSelectedCategoryForDrill({ id: item.category_id, name: item.category_name });
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" />
                  <XAxis dataKey="category_name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }}
                    itemStyle={{ color: '#818cf8' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="total_stock" radius={[4, 4, 0, 0]} barSize={32} className="cursor-pointer">
                    {inventoryDist.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={paymentColors[index % paymentColors.length]} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">No inventory distribution data</div>
            )}
          </div>
        </div>
      </div>

      {/* Low Stock & Out of Stock Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center gap-2">
              <WarningIcon className="text-amber-600 dark:text-amber-400" fontSize="small" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Top Low Stock Products</h2>
            </div>
            <button
              onClick={() => setActiveDrillDown('low_stock')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View all ({kpis?.low_stock_products || 0})
            </button>
          </div>
          <div className="p-4 h-72">
            {lowStockLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-lg h-full min-h-[180px]" />
              </div>
            ) : lowStockProducts && lowStockProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={lowStockProducts}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  onClick={(state: any) => {
                    if (state && state.activePayload && state.activePayload.length > 0) {
                      const item = state.activePayload[0].payload;
                      if (item && item.product_id) {
                        setSelectedProductForDrill({ id: item.product_id, name: item.product_name });
                      }
                    }
                  }}
                >
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="product_name" width={140} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }}
                    itemStyle={{ color: '#818cf8' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="available_stock" radius={[4, 4, 4, 4]} barSize={14} className="cursor-pointer">
                    {lowStockProducts.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill="#f59e0b" fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-1">
                <WarningIcon className="text-emerald-500" fontSize="large" />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">All stock levels healthy</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center gap-2">
              <OutOfStockIcon className="text-red-600 dark:text-red-400" fontSize="small" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Out of Stock Products List</h2>
            </div>
            <button
              onClick={() => setActiveDrillDown('out_of_stock')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View all ({kpis?.out_of_stock_products || 0})
            </button>
          </div>
          <div className="p-4 h-72 overflow-y-auto">
            {outOfStockLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="space-y-2">
                  <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
              </div>
            ) : outOfStockProducts && outOfStockProducts.length > 0 ? (
              <div className="space-y-2">
                {outOfStockProducts.slice(0, 10).map((item: OutOfStockProductResponse) => (
                  <div
                    key={item.product_id}
                    onClick={() => setSelectedProductForDrill({ id: item.product_id, name: item.product_name })}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{item.product_name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{item.sku} {item.brand ? `• ${item.brand}` : ''}</div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-xs font-bold text-red-600 dark:text-red-400">Out of Stock</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.last_sale_date ? new Date(item.last_sale_date).toLocaleDateString() : 'Never sold'}
        </div>
      </div>

      {/* Customer Analytics Section */}
      <div className="space-y-6 md:space-y-8">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Customer Analytics</h2>
        </div>

        {/* Top KPIs Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
          <KPISkeleton loading={kpisLoading} title="Total Customers" />
          <KPISkeleton loading={kpisLoading} title="Active Customers" />
          <KPISkeleton loading={kpisLoading} title="New Customers" />
          <KPISkeleton loading={kpisLoading} title="Returning Customers" />
        </div>

        {/* Row: Customer Growth + Monthly Acquisition */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
          <ChartCard title="Customer Growth Trend" icon={<TrendingIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />} loading={customerGrowthLoading} isEmpty={!customerGrowth || customerGrowth.length === 0} emptyText="No customer growth data available">
            <div className="p-4 h-72">
              {customerGrowth && customerGrowth.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={customerGrowth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="cgGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }} itemStyle={{ color: '#818cf8' }} labelStyle={{ color: '#94a3b8' }} />
                    <Area type="monotone" dataKey="new_customers" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#cgGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <PeopleIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                  <span className="text-xs font-semibold">No data available</span>
                </div>
              )}
            </div>
          </ChartCard>
          <ChartCard title="Monthly Customer Acquisition" icon={<PeopleIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />} loading={monthlyAcquisitionLoading} isEmpty={!monthlyAcquisition || monthlyAcquisition.length === 0} emptyText="No acquisition data available">
            <div className="p-4 h-72">
              {monthlyAcquisition && monthlyAcquisition.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyAcquisition} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }} itemStyle={{ color: '#818cf8' }} labelStyle={{ color: '#94a3b8' }} />
                    <Bar dataKey="new_customers" radius={[4, 4, 0, 0]} barSize={20}>
                      {monthlyAcquisition.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill="#10b981" fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <PeopleIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                  <span className="text-xs font-semibold">No data available</span>
                </div>
              )}
            </div>
          </ChartCard>
        </div>

        {/* Row: New vs Returning + Revenue by Type */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
          <ChartCard title="New vs Returning Customers" icon={<TrendingIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />} loading={false} isEmpty={false} emptyText="">
            <div className="p-4 h-72">
              <NewVsReturningView />
            </div>
          </ChartCard>
          <ChartCard title="Revenue by Customer Type" icon={<MuiBarChartIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />} loading={revenueByTypeLoading} isEmpty={!revenueByType || revenueByType.length === 0} emptyText="No revenue breakdown available">
            <div className="p-4 h-72">
              {revenueByType && revenueByType.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={revenueByType} dataKey="revenue" nameKey="customer_type" cx="50%" cy="50%" outerRadius={90} paddingAngle={4} label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}>
                      {revenueByType.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={paymentColors[index % paymentColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }} itemStyle={{ color: '#818cf8' }} formatter={(value: any) => [formatCurrency(value), 'Revenue']} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <MuiBarChartIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                  <span className="text-xs font-semibold">No revenue data available</span>
                </div>
              )}
            </div>
          </ChartCard>
        </div>

        {/* Row: Segmentation + Purchase Frequency */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
          <ChartCard title="Customer Segmentation" icon={<PeopleIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />} loading={segmentationLoading} isEmpty={!segmentation || segmentation.total_segmented === 0} emptyText="No segmentation data yet. Link sales to customers.">
            <div className="p-4 h-72">
              {segmentation && segmentation.total_segmented > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(segmentation.segments).map(([segment, count]) => (
                      <div key={segment} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{segment}</p>
                        <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{count}</p>
                        <p className="text-xs text-slate-500">{((count / segmentation.total_segmented) * 100).toFixed(1)}% of customers</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-semibold">New: 1 order</span>
                    <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-semibold">Regular: 2+ orders</span>
                    <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-semibold">Loyal: 5+ orders & ₹1,000+ spend</span>
                    <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-semibold">VIP: 10+ orders & ₹5,000+ spend</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <PeopleIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                  <span className="text-xs font-semibold">No segmentation data yet. Link sales to customers.</span>
                </div>
              )}
            </div>
          </ChartCard>
          <ChartCard title="Purchase Frequency Distribution" icon={<ReceiptIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />} loading={purchaseFreqLoading} isEmpty={!purchaseFreq || purchaseFreq.length === 0} emptyText="No purchase frequency data available">
            <div className="p-4 h-72">
              {purchaseFreq && purchaseFreq.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={purchaseFreq} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" />
                    <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }} itemStyle={{ color: '#818cf8' }} labelStyle={{ color: '#94a3b8' }} />
                    <Bar dataKey="customers" radius={[4, 4, 0, 0]} barSize={28}>
                      {purchaseFreq.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={channelColors[index % channelColors.length]} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <ReceiptIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                  <span className="text-xs font-semibold">No data available</span>
                </div>
              )}
            </div>
          </ChartCard>
        </div>

        {/* Row: Location Distribution + Spending Distribution */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
          <ChartCard title="Customer Location Distribution" icon={<StoreIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />} loading={locationDistLoading} isEmpty={!locationDist || locationDist.length === 0} emptyText="No location data available">
            <div className="p-4 h-72">
              {locationDist && locationDist.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={locationDist} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="state" width={80} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }} itemStyle={{ color: '#818cf8' }} labelStyle={{ color: '#94a3b8' }} formatter={(value: any, name: any) => [value, name === 'count' ? 'Customers' : '']} />
                    <Bar dataKey="count" radius={[4, 4, 4, 4]} barSize={14}>
                      {locationDist.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={channelColors[index % channelColors.length]} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <StoreIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                  <span className="text-xs font-semibold">No location data available</span>
                </div>
              )}
            </div>
          </ChartCard>
          <ChartCard title="Customer Spending Distribution" icon={<MoneyIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />} loading={spendingDistLoading} isEmpty={!spendingDist || spendingDist.total_customers === 0} emptyText="No spending data available">
            <div className="p-4 h-72">
              {spendingDist && spendingDist.total_customers > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(spendingDist.buckets).map(([range, count]) => ({ range, count }))} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" />
                    <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }} itemStyle={{ color: '#818cf8' }} labelStyle={{ color: '#94a3b8' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={28}>
                      {Object.keys(spendingDist.buckets).map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={paymentColors[index % paymentColors.length]} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <MoneyIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                  <span className="text-xs font-semibold">No data available</span>
                </div>
              )}
            </div>
          </ChartCard>
        </div>

        {/* Row: Top Customers + Recent Customers + Revenue Contribution */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
          <ChartCard title="Top Customers" icon={<PeopleIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />} loading={topCustomersLoading} isEmpty={!topCustomers || topCustomers.length === 0} emptyText="No customer data available">
            <div className="p-4 h-72 overflow-y-auto">
              {topCustomers && topCustomers.length > 0 ? (
                <div className="space-y-3">
                  {topCustomers.map((c, idx) => (
                    <div key={c.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold">
                          #{idx + 1 + (topCustomersPage - 1) * PAGE_SIZE}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{c.first_name} {c.last_name}</div>
                          <div className="text-[10px] text-slate-400">{c.email || '—'}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{formatCurrency(c.total_spent)}</div>
                        <div className="text-[10px] text-slate-400">{c.total_purchases} orders</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <PeopleIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                  <span className="text-xs font-semibold">No customer data available</span>
                </div>
              )}
            </div>
            <div className="px-4 pb-3">
              <Pagination page={topCustomersPage} pageSize={PAGE_SIZE} total={topCustomersTotal} onPageChange={setTopCustomersPage} />
            </div>
          </ChartCard>

          <ChartCard title="Recent Customers" icon={<StoreIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />} loading={recentCustomersLoading} isEmpty={!recentCustomers || recentCustomers.length === 0} emptyText="No recent customers">
            <div className="p-4 h-72 overflow-y-auto">
              {recentCustomers && recentCustomers.length > 0 ? (
                <div className="space-y-3">
                  {recentCustomers.map((c) => (
                    <div key={c.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-xs font-bold">
                          {c.first_name.charAt(0)}{c.last_name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{c.first_name} {c.last_name}</div>
                          <div className="text-[10px] text-slate-400">{c.customer_type} • {c.status}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{formatCurrency(c.total_spent)}</div>
                        <div className="text-[10px] text-slate-400">{c.total_purchases} orders</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <StoreIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                  <span className="text-xs font-semibold">No recent customers</span>
                </div>
              )}
            </div>
          </ChartCard>

          <ChartCard title="Revenue Contribution" icon={<MoneyIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />} loading={revenueContributionLoading} isEmpty={!revenueContribution || revenueContribution.length === 0} emptyText="No revenue data available">
            <div className="p-4 h-72 overflow-y-auto">
              {revenueContribution && revenueContribution.length > 0 ? (
                <div className="space-y-3">
                  {revenueContribution.map((c) => (
                    <div key={c.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs font-bold">
                          {c.first_name.charAt(0)}{c.last_name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{c.first_name} {c.last_name}</div>
                          <div className="text-[10px] text-slate-400">{c.email || '—'}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{formatCurrency(c.revenue)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <MoneyIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
                  <span className="text-xs font-semibold">No revenue data available</span>
                </div>
              )}
            </div>
          </ChartCard>
        </div>
      </div>

                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-1">
                <OutOfStockIcon className="text-emerald-500" fontSize="large" />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">No products currently out of stock</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inventory Value by Category Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
          <MoneyIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Inventory Value by Category</h2>
        </div>
        <div className="p-4 h-72">
          {inventoryValue && inventoryValue.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={inventoryValue}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                onClick={(state: any) => {
                  if (state && state.activePayload && state.activePayload.length > 0) {
                    const item = state.activePayload[0].payload;
                    if (item && item.category_id) {
                      setSelectedCategoryForDrill({ id: item.category_id, name: item.category_name });
                    }
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800/40" />
                <XAxis dataKey="category_name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} width={80} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', fontSize: 12 }}
                  itemStyle={{ color: '#818cf8' }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value: any) => [formatCurrency(value), 'Cost Value']}
                />
                <Bar dataKey="total_cost_value" radius={[4, 4, 0, 0]} barSize={28} className="cursor-pointer">
                  {inventoryValue.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill="#6366f1" fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">No inventory valuation data</div>
          )}
        </div>
      </div>

      {/* DRILL-DOWN MODAL 1: Main KPI Drill-Down Drawer */}
      {activeDrillDown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <ReceiptIcon className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white capitalize">
                  {activeDrillDown.replace('_', ' ')} Details
                </h3>
              </div>
              <button
                onClick={() => setActiveDrillDown(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Search bar inside modal */}
              <div className="relative">
                <SearchIcon className="absolute left-3 top-2.5 text-slate-400" fontSize="small" />
                <input
                  type="text"
                  placeholder="Filter records..."
                  value={drillSearchQuery}
                  onChange={(e) => setDrillSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* TRANSACTIONS VIEW */}
              {activeDrillDown === 'transactions' && (
                <div className="overflow-x-auto max-h-96">
                  {drillTransactionsLoading ? (
                    <div className="p-8 text-center text-xs text-slate-400">Loading sales transactions...</div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="p-3">Invoice</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Customer</th>
                          <th className="p-3">Channel</th>
                          <th className="p-3">Payment</th>
                          <th className="p-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {drillTransactions
                          .filter((t) =>
                            drillSearchQuery
                              ? t.invoice_number.toLowerCase().includes(drillSearchQuery.toLowerCase()) ||
                                (t.customer_name && t.customer_name.toLowerCase().includes(drillSearchQuery.toLowerCase()))
                              : true
                          )
                          .map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{tx.invoice_number}</td>
                              <td className="p-3 text-slate-500">{new Date(tx.sale_date).toLocaleDateString()}</td>
                              <td className="p-3">{tx.customer_name || 'Walk-in Customer'}</td>
                              <td className="p-3"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">{tx.sales_channel}</span></td>
                              <td className="p-3">{tx.payment_method}</td>
                              <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(tx.total_amount)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* PRODUCTS VIEW */}
              {activeDrillDown === 'products' && (
                <div className="overflow-x-auto max-h-96">
                  {drillProductsLoading ? (
                    <div className="p-8 text-center text-xs text-slate-400">Loading catalog items...</div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="p-3">Product Name</th>
                          <th className="p-3">SKU</th>
                          <th className="p-3">Category</th>
                          <th className="p-3 text-center">Stock</th>
                          <th className="p-3 text-right">Unit Price</th>
                          <th className="p-3 text-right">Total Sold</th>
                          <th className="p-3 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {drillProducts
                          .filter((p) =>
                            drillSearchQuery
                              ? p.product_name.toLowerCase().includes(drillSearchQuery.toLowerCase()) ||
                                p.sku.toLowerCase().includes(drillSearchQuery.toLowerCase())
                              : true
                          )
                          .map((p) => (
                            <tr
                              key={p.product_id}
                              onClick={() => setSelectedProductForDrill({ id: p.product_id, name: p.product_name })}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                            >
                              <td className="p-3 font-semibold text-slate-900 dark:text-white">{p.product_name}</td>
                              <td className="p-3 font-mono text-slate-500">{p.sku}</td>
                              <td className="p-3">{p.category_name || 'Uncategorized'}</td>
                              <td className="p-3 text-center font-bold">{p.stock_quantity}</td>
                              <td className="p-3 text-right font-mono">{formatCurrency(p.unit_price)}</td>
                              <td className="p-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{p.total_sold}</td>
                              <td className="p-3 text-right font-mono font-bold">{formatCurrency(p.total_revenue)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* LOW STOCK VIEW */}
              {activeDrillDown === 'low_stock' && (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Product</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 text-center">Available Stock</th>
                        <th className="p-3 text-center">Threshold</th>
                        <th className="p-3 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {(lowStockProducts || [])
                        .filter((p) =>
                          drillSearchQuery
                            ? p.product_name.toLowerCase().includes(drillSearchQuery.toLowerCase())
                            : true
                        )
                        .map((p) => (
                          <tr
                            key={p.product_id}
                            onClick={() => setSelectedProductForDrill({ id: p.product_id, name: p.product_name })}
                            className="hover:bg-amber-50/50 dark:hover:bg-amber-950/20 cursor-pointer"
                          >
                            <td className="p-3 font-semibold text-slate-900 dark:text-white">{p.product_name}</td>
                            <td className="p-3 font-mono text-slate-500">{p.sku}</td>
                            <td className="p-3">{p.category_name || 'N/A'}</td>
                            <td className="p-3 text-center font-bold text-amber-600 dark:text-amber-400">{p.available_stock}</td>
                            <td className="p-3 text-center font-mono">{p.low_stock_threshold}</td>
                            <td className="p-3 text-right font-mono font-bold">{formatCurrency(p.inventory_value)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* OUT OF STOCK VIEW */}
              {activeDrillDown === 'out_of_stock' && (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Product</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3">Brand</th>
                        <th className="p-3 text-right">Unit Price</th>
                        <th className="p-3 text-right">Last Sale Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {(outOfStockProducts || [])
                        .filter((p) =>
                          drillSearchQuery
                            ? p.product_name.toLowerCase().includes(drillSearchQuery.toLowerCase())
                            : true
                        )
                        .map((p) => (
                          <tr
                            key={p.product_id}
                            onClick={() => setSelectedProductForDrill({ id: p.product_id, name: p.product_name })}
                            className="hover:bg-rose-50/50 dark:hover:bg-rose-950/20 cursor-pointer"
                          >
                            <td className="p-3 font-semibold text-slate-900 dark:text-white">{p.product_name}</td>
                            <td className="p-3 font-mono text-slate-500">{p.sku}</td>
                            <td className="p-3">{p.brand || 'N/A'}</td>
                            <td className="p-3 text-right font-mono">{formatCurrency(p.unit_price)}</td>
                            <td className="p-3 text-right text-slate-500 font-mono">
                              {p.last_sale_date ? new Date(p.last_sale_date).toLocaleDateString() : 'Never sold'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* CATEGORIES VIEW */}
              {activeDrillDown === 'categories' && (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Category Name</th>
                        <th className="p-3 text-center">Product Count</th>
                        <th className="p-3 text-center">Total Stock</th>
                        <th className="p-3 text-right">Inventory Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {(inventoryDist || [])
                        .filter((c) =>
                          drillSearchQuery
                            ? c.category_name.toLowerCase().includes(drillSearchQuery.toLowerCase())
                            : true
                        )
                        .map((c, idx) => (
                          <tr
                            key={idx}
                            onClick={() => {
                              if (c.category_id) {
                                setSelectedCategoryForDrill({ id: c.category_id, name: c.category_name });
                              }
                            }}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                          >
                            <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center justify-between">
                              <span>{c.category_name}</span>
                              <ChevronRightIcon fontSize="small" className="text-slate-400" />
                            </td>
                            <td className="p-3 text-center font-semibold">{c.product_count}</td>
                            <td className="p-3 text-center font-bold text-indigo-600 dark:text-indigo-400">{c.total_stock}</td>
                            <td className="p-3 text-right font-mono font-bold">{formatCurrency(c.total_value)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DRILL-DOWN MODAL 2: Category Products Modal */}
      {selectedCategoryForDrill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Category: {selectedCategoryForDrill.name}
                </h3>
                <p className="text-xs text-slate-500">Products catalog & inventory breakdown</p>
              </div>
              <button
                onClick={() => setSelectedCategoryForDrill(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {drillCategoryProductsLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading category products...</div>
              ) : drillCategoryProducts.length > 0 ? (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Product Name</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Available Stock</th>
                        <th className="p-3 text-right">Unit Price</th>
                        <th className="p-3 text-right">Total Sold</th>
                        <th className="p-3 text-right">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {drillCategoryProducts.map((p) => (
                        <tr
                          key={p.product_id}
                          onClick={() => setSelectedProductForDrill({ id: p.product_id, name: p.product_name })}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                        >
                          <td className="p-3 font-semibold text-slate-900 dark:text-white">{p.product_name}</td>
                          <td className="p-3 font-mono text-slate-500">{p.sku}</td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.stock_status === 'IN_STOCK'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : p.stock_status === 'LOW_STOCK'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {p.stock_status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold">{p.available_stock}</td>
                          <td className="p-3 text-right font-mono">{formatCurrency(p.unit_price)}</td>
                          <td className="p-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{p.total_sold}</td>
                          <td className="p-3 text-right font-mono font-bold">{formatCurrency(p.total_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">No products found in this category</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DRILL-DOWN MODAL 3: Product Sales Transactions Modal */}
      {selectedProductForDrill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Product Sales: {selectedProductForDrill.name}
                </h3>
                <p className="text-xs text-slate-500">Individual transaction sales history</p>
              </div>
              <button
                onClick={() => setSelectedProductForDrill(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {drillProductTransactionsLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading product transaction history...</div>
              ) : drillProductTransactions.length > 0 ? (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Invoice</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Channel</th>
                        <th className="p-3">Payment</th>
                        <th className="p-3 text-right">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {drillProductTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{tx.invoice_number}</td>
                          <td className="p-3 text-slate-500">{new Date(tx.sale_date).toLocaleDateString()}</td>
                          <td className="p-3">{tx.customer_name || 'Walk-in Customer'}</td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">{tx.sales_channel}</span></td>
                          <td className="p-3">{tx.payment_method}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(tx.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">No individual transactions recorded for this product</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ChartCard: React.FC<{ title: string; icon: React.ReactNode; loading: boolean; isEmpty: boolean; emptyText: string; children: React.ReactNode }> = ({ title, icon, loading, isEmpty, emptyText, children }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
      {icon}
      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">{title}</h2>
    </div>
    {loading ? (
      <div className="p-4 h-72 flex items-center justify-center">
        <div className="h-full w-full animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      </div>
    ) : isEmpty ? (
      <div className="flex flex-col items-center justify-center h-72 text-slate-400 space-y-2">
        <ReceiptIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
        <span className="text-xs font-semibold">{emptyText}</span>
      </div>
    ) : (
      children
    )}
  </div>
);

const KPISkeleton: React.FC<{ loading: boolean; title: string }> = ({ loading, title }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 md:p-5 shadow-sm">
    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{title}</p>
    {loading ? (
      <div className="mt-3 h-7 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
    ) : (
      <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">-</p>
    )}
  </div>
);

const NewVsReturningView: React.FC = () => {
  const { data: nvr, isLoading } = useQuery({
    queryKey: ['customers', 'new-vs-returning-analytics'],
    queryFn: () => getNewVsReturning(),
  });
  const data = nvr || { new_customers: 0, returning_customers: 0, new_customer_revenue: 0, returning_customer_revenue: 0 };
  const total = data.new_customers + data.returning_customers;

  if (isLoading) return <div className="flex items-center justify-center h-full"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div>;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
        <PeopleIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
        <span className="text-xs font-semibold">No customer data yet.</span>
      </div>
    );
  }

  const newPct = total > 0 ? (data.new_customers / total) * 100 : 0;
  const returnPct = total > 0 ? (data.returning_customers / total) * 100 : 0;
  const totalRevenue = data.new_customer_revenue + data.returning_customer_revenue;
  const newRevPct = totalRevenue > 0 ? (data.new_customer_revenue / totalRevenue) * 100 : 0;
  const returnRevPct = totalRevenue > 0 ? (data.returning_customer_revenue / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-5 h-full overflow-y-auto">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Customers</p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{data.new_customers}</p>
          <p className="text-xs text-slate-500">{newPct.toFixed(1)}% of total</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Returning Customers</p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{data.returning_customers}</p>
          <p className="text-xs text-slate-500">{returnPct.toFixed(1)}% of total</p>
        </div>
      </div>
      <div className="space-y-3">
        {[
          { label: 'New Customers', value: data.new_customers, pct: newPct, color: '#6366f1' },
          { label: 'Returning Customers', value: data.returning_customers, pct: returnPct, color: '#10b981' },
        ].map((item) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex justify-between text-sm font-semibold text-slate-700 dark:text-slate-300">
              <span>{item.label}</span>
              <span className="font-mono">{item.value} ({item.pct.toFixed(1)}%)</span>
            </div>
            <div className="h-3 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(item.pct, 100)}%`, backgroundColor: item.color }} />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Customer Revenue</p>
          <p className="text-sm font-extrabold text-slate-900 dark:text-white">{formatCurrency(data.new_customer_revenue)}</p>
          <p className="text-xs text-slate-500">{newRevPct.toFixed(1)}% of total revenue</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Returning Customer Revenue</p>
          <p className="text-sm font-extrabold text-slate-900 dark:text-white">{formatCurrency(data.returning_customer_revenue)}</p>
          <p className="text-xs text-slate-500">{returnRevPct.toFixed(1)}% of total revenue</p>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
