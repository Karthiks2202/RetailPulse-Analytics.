import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
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
  type PaymentMethodBreakdown,
  type Product,
  type Category,
  type ExportRequest,
} from '../../api/analyticsApi';
import { getCustomers, type Customer, type TopCustomerResponse } from '../../api/customerApi';
import {
  FileDownload as ExportIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
} from '@mui/icons-material';
import SalesAnalyticsFilters from './components/SalesAnalyticsFilters';
import AnalyticsKpis from './components/AnalyticsKpis';
import SalesOverviewChart from './components/SalesOverviewChart';
import SalesVsOrdersChart from './components/SalesVsOrdersChart';
import TopProductsTable from './components/TopProductsTable';
import TopCustomersTable from './components/TopCustomersTable';
import PaymentMethodsChart from './components/PaymentMethodsChart';

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

export const SalesAnalytics: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [datePreset, setDatePreset] = useState<string>('last_30_days');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [topCustomersPage, setTopCustomersPage] = useState(1);
  const [topProductsPage, setTopProductsPage] = useState(1);
  const [topProductsSortBy, setTopProductsSortBy] = useState<'total_revenue' | 'total_quantity'>('total_revenue');
  const [interval, setInterval] = useState<string>('daily');
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
    enabled: !dateError,
  });

  const { data: revenueTrendData, isLoading: revenueLoading } = useQuery({
    queryKey: ['sales-analytics', 'revenue-trend', interval, analyticsFilters],
    queryFn: () => getRevenueTrend(interval, analyticsFilters),
    enabled: !dateError,
  });
  const revenueTrend = (revenueTrendData || []) as RevenueTrendPoint[];

  const { data: salesTrendData, isLoading: salesLoading } = useQuery({
    queryKey: ['sales-analytics', 'sales-trend', interval, analyticsFilters],
    queryFn: () => getSalesTrend(interval, analyticsFilters),
    enabled: !dateError,
  });
  const salesTrend = (salesTrendData || []) as SalesTrendPoint[];

  const { data: topProductsData, isLoading: topProductsLoading } = useQuery({
    queryKey: ['sales-analytics', 'top-products', analyticsFilters, topProductsPage, topProductsSortBy],
    queryFn: () => getTopProducts(10, analyticsFilters, topProductsPage, PAGE_SIZE, topProductsSortBy, 'desc'),
    enabled: !dateError,
  });
  const _topProducts = ((topProductsData as any)?.items || []) as TopProductResponse[];
  const topProductsTotal = (topProductsData as any)?.total || 0;

  const { data: topCustomersData, isLoading: topCustomersLoading } = useQuery({
    queryKey: ['sales-analytics', 'top-customers', analyticsFilters, topCustomersPage],
    queryFn: () => getTopCustomers(10, analyticsFilters, topCustomersPage, PAGE_SIZE),
    enabled: !dateError,
  });
  const topCustomers = (topCustomersData?.items || []) as TopCustomerResponse[];
  const topCustomersTotal = topCustomersData?.total || 0;

  const { data: paymentMethodsData, isLoading: paymentMethodsLoading } = useQuery({
    queryKey: ['sales-analytics', 'payment-methods', analyticsFilters],
    queryFn: () => getPaymentMethods(analyticsFilters),
    enabled: !dateError,
  });
  const paymentMethods = (paymentMethodsData || []) as PaymentMethodBreakdown[];

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

  const handleExportCSV = async (reportType: ExportRequest['report_type'] = 'kpis') => {
    setExportingType(`csv-${reportType}`);
    try {
      const blob = await exportAnalytics({ export_type: 'csv', report_type: reportType, filters: analyticsFilters });
      downloadBlob(blob, getExportFilename(reportType, 'csv'));
      showNotification('CSV report exported successfully', 'success');
    } catch (err) {
      console.error('CSV Export Error:', err);
      showNotification('Failed to export CSV report. Please try again.', 'error');
    } finally {
      setExportingType(null);
    }
  };

  const handleExportPDF = async (reportType: ExportRequest['report_type'] = 'kpis') => {
    setExportingType(`pdf-${reportType}`);
    try {
      const blob = await exportAnalytics({ export_type: 'pdf', report_type: reportType, filters: analyticsFilters });
      downloadBlob(blob, getExportFilename(reportType, 'pdf'));
      showNotification('PDF report exported successfully', 'success');
    } catch (err) {
      console.error('PDF Export Error:', err);
      showNotification('Failed to export PDF report. Please try again.', 'error');
    } finally {
      setExportingType(null);
    }
  };

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

      <SalesAnalyticsFilters
        datePreset={datePreset}
        setDatePreset={setDatePreset}
        customDateFrom={customDateFrom}
        setCustomDateFrom={setCustomDateFrom}
        customDateTo={customDateTo}
        setCustomDateTo={setCustomDateTo}
        dateError={dateError}
        filters={filters}
        updateFilter={updateFilter}
        clearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        products={products}
        categories={categories}
        customers={customers}
      />

      <AnalyticsKpis kpis={kpis} loading={kpisLoading} error={kpisError} />

      {/* Visualizations Grid 1: Revenue Trend & Sales vs Orders */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        <SalesOverviewChart
          data={revenueTrend}
          loading={revenueLoading}
          interval={interval}
          onIntervalChange={setInterval}
        />
        <SalesVsOrdersChart data={salesTrend} loading={salesLoading} />
      </div>

      {/* Top Performing Products */}
      <TopProductsTable
        products={_topProducts}
        loading={topProductsLoading}
        page={topProductsPage}
        pageSize={PAGE_SIZE}
        total={topProductsTotal}
        onPageChange={setTopProductsPage}
        sortBy={topProductsSortBy}
        onSortChange={setTopProductsSortBy}
      />

      {/* Customer Revenue Analysis & Payment Method Analysis */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        <TopCustomersTable
          customers={topCustomers}
          loading={topCustomersLoading}
          page={topCustomersPage}
          pageSize={PAGE_SIZE}
          total={topCustomersTotal}
          onPageChange={setTopCustomersPage}
        />
        <PaymentMethodsChart data={paymentMethods} loading={paymentMethodsLoading} />
      </div>
    </div>
  );
};

export default SalesAnalytics;
