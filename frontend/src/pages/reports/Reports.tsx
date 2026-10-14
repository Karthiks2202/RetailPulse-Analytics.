import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { jsPDF } from 'jspdf';
import _autoTable from 'jspdf-autotable';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  getReportData,
  generateReport,
  getReportHistory,
  downloadReport,
  type ReportType,
  type ReportFilter,
  type ReportGenerateRequest,
  type ReportHistory,
} from '../../api/reportApi';
import { getCategories } from '../../api/categoryApi';
import { getProducts } from '../../api/productApi';
import { getCustomers } from '../../api/customerApi';
import {
  Close as CloseIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';

const REPORT_TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: 'sales', label: 'Sales Report' },
  { value: 'inventory', label: 'Inventory Report' },
  { value: 'customer', label: 'Customer Report' },
  { value: 'product_performance', label: 'Product Performance Report' },
  { value: 'stock_movement', label: 'Stock Movement Report' },
];

const inputClass =
  'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition-all';

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30',
  failed: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30',
  processing: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30',
  pending: 'bg-slate-50 dark:bg-slate-950/30 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-900/30',
};

interface FilterFormValues {
  date_from: string;
  date_to: string;
  product_id: string;
  category_id: string;
  brand: string;
  customer_id: string;
  sales_status: string;
  stock_status: string;
  payment_method: string;
  payment_status: string;
  sales_channel: string;
  movement_type: string;
  search: string;
}

const Reports: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'ANALYST';

  const [selectedReportType, setSelectedReportType] = useState<ReportType>('sales');
  const [showFilters, setShowFilters] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [dataPage, setDataPage] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | ''>('');
  const [historySortBy, setHistorySortBy] = useState<string>('');
  const [historySortOrder, setHistorySortOrder] = useState<'asc' | 'desc' | ''>('');

  const { register: registerFilter, reset: resetFilters, watch: watchFilters } = useForm<FilterFormValues>({
    defaultValues: {
      date_from: '',
      date_to: '',
      product_id: '',
      category_id: '',
      brand: '',
      customer_id: '',
      sales_status: '',
      stock_status: '',
      payment_method: '',
      payment_status: '',
      sales_channel: '',
      movement_type: '',
      search: '',
    },
  });

  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ['reportData', selectedReportType, dataPage, watchFilters(), sortBy, sortOrder],
    queryFn: async () => {
      const filters: ReportFilter = {};
      const vals = watchFilters();
      if (vals.date_from) filters.date_from = vals.date_from;
      if (vals.date_to) filters.date_to = vals.date_to;
      if (vals.product_id) filters.product_id = vals.product_id;
      if (vals.category_id) filters.category_id = vals.category_id;
      if (vals.brand) filters.brand = vals.brand;
      if (vals.customer_id) filters.customer_id = vals.customer_id;
      if (vals.sales_status) filters.sales_status = vals.sales_status;
      if (vals.stock_status) filters.stock_status = vals.stock_status;
      if (vals.payment_method) filters.payment_method = vals.payment_method;
      if (vals.payment_status) filters.payment_status = vals.payment_status;
      if (vals.sales_channel) filters.sales_channel = vals.sales_channel;
      if (vals.movement_type) filters.movement_type = vals.movement_type;
      if (vals.search) filters.search = vals.search;
      const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null));
      return getReportData({ 
        report_type: selectedReportType, 
        filters: activeFilters, 
        page: dataPage, 
        page_size: 20, 
        ...(sortBy && sortOrder ? { sort_by: sortBy, sort_order: sortOrder } : {})
      });
    },
    enabled: isAdmin,
  });

  const generateMutation = useMutation({
    mutationFn: (payload: ReportGenerateRequest) => generateReport(payload),
    onSuccess: () => {
      showNotification('Report generated successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['reportHistory'] });
    },
    onError: (error: any) => {
      showNotification(error?.response?.data?.detail || 'Failed to generate report', 'error');
    },
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['reportHistory', historyPage],
    queryFn: () => getReportHistory({ page: historyPage, page_size: 10 }),
    enabled: isAdmin,
  });

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => getCategories(), enabled: isAdmin });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => getProducts({ status: 'ACTIVE' }), enabled: isAdmin });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => getCustomers({ status: 'ACTIVE' }), enabled: isAdmin });

  const handleGenerate = async (format: 'csv' | 'pdf') => {
    setIsGenerating(true);
    try {
      const filters: ReportFilter = {};
      const vals = watchFilters();
      if (vals.date_from) filters.date_from = vals.date_from;
      if (vals.date_to) filters.date_to = vals.date_to;
      if (vals.product_id) filters.product_id = vals.product_id;
      if (vals.category_id) filters.category_id = vals.category_id;
      if (vals.brand) filters.brand = vals.brand;
      if (vals.customer_id) filters.customer_id = vals.customer_id;
      if (vals.sales_status) filters.sales_status = vals.sales_status;
      if (vals.stock_status) filters.stock_status = vals.stock_status;
      if (vals.payment_method) filters.payment_method = vals.payment_method;
      if (vals.payment_status) filters.payment_status = vals.payment_status;
      if (vals.sales_channel) filters.sales_channel = vals.sales_channel;
      if (vals.movement_type) filters.movement_type = vals.movement_type;
      if (vals.search) filters.search = vals.search;
      const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null));

      const result = await generateMutation.mutateAsync({
        report_type: selectedReportType,
        filters: activeFilters,
        export_format: format,
      });
      if (result.download_url) {
        handleDownload(result.id);
      }
    } catch (e) {
      // handled in mutation
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (historyId: string) => {
    try {
      const blob = await downloadReport(historyId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${historyId}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      showNotification('Failed to download report', 'error');
    }
  };

  const handleExportCSV = () => {
    if (!reportData) return;
    const headers = reportData.columns.join(',');
    const rows = reportData.rows.map((r) => reportData.columns.map((c) => JSON.stringify(r[c] ?? '')).join(','));
    const lines = [];
    lines.push(`Report: ${REPORT_TYPE_OPTIONS.find((r) => r.value === selectedReportType)?.label || 'Report'}`);
    lines.push(`Generated At: ${new Date().toISOString()}`);
    if (reportData.applied_filters && Object.keys(reportData.applied_filters).length > 0) {
      lines.push('Applied Filters:');
      for (const [key, value] of Object.entries(reportData.applied_filters)) {
        if (value !== null && value !== undefined && value !== '') {
          lines.push(`  ${filterLabels[key] || key}: ${formatFilterValue(key, value)}`);
        }
      }
    }
    if (reportData.period) {
      lines.push(`Period: ${reportData.period.from || '...'} to ${reportData.period.to || '...'}`);
    }
    lines.push('');
    const csvContent = [...lines, headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedReportType}_report.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    if (!reportData) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${REPORT_TYPE_OPTIONS.find((r) => r.value === selectedReportType)?.label || 'Report'}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated At: ${new Date().toISOString()}`, 14, 22);
    let yPos = 29;
    if (reportData.applied_filters && Object.keys(reportData.applied_filters).length > 0) {
      doc.text('Applied Filters:', 14, yPos);
      yPos += 5;
      for (const [key, value] of Object.entries(reportData.applied_filters)) {
        if (value !== null && value !== undefined && value !== '') {
          doc.text(`  ${filterLabels[key] || key}: ${formatFilterValue(key, value)}`, 14, yPos);
          yPos += 5;
        }
      }
    }
    if (reportData.period) {
      doc.text(`Period: ${reportData.period.from || '...'} to ${reportData.period.to || '...'}`, 14, yPos);
      yPos += 7;
    }
    const tableData = reportData.rows.map((r) => reportData.columns.map((c) => String(r[c] ?? '')));
    _autoTable(doc, { head: [reportData.columns], body: tableData, startY: yPos });
    doc.save(`${selectedReportType}_report.pdf`);
  };

  const clearFilters = () => {
    resetFilters();
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else if (sortOrder === 'desc') { setSortBy(''); setSortOrder(''); }
      else setSortOrder('asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setDataPage(1);
  };

  const handleHistorySort = (column: string) => {
    if (historySortBy === column) {
      if (historySortOrder === 'asc') setHistorySortOrder('desc');
      else if (historySortOrder === 'desc') { setHistorySortBy(''); setHistorySortOrder(''); }
      else setHistorySortOrder('asc');
    } else {
      setHistorySortBy(column);
      setHistorySortOrder('asc');
    }
  };

  const getSortIndicator = (column: string, currentSortBy: string, currentSortOrder: string) => {
    if (currentSortBy !== column) return '↕';
    if (currentSortOrder === 'asc') return '↑';
    if (currentSortOrder === 'desc') return '↓';
    return '↕';
  };

  const sortedRows = useMemo(() => {
    if (!reportData || !sortBy || !sortOrder) return reportData?.rows || [];
    return [...reportData.rows].sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return sortOrder === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [reportData, sortBy, sortOrder]);

  const sortedHistoryItems = useMemo(() => {
    if (!historyData || !historySortBy || !historySortOrder) return historyData?.items || [];
    return [...historyData.items].sort((a, b) => {
      let aVal = (a as any)[historySortBy];
      let bVal = (b as any)[historySortBy];
      if (historySortBy === 'generated_at') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return historySortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return historySortOrder === 'asc' ? -1 : 1;
      if (aStr > bStr) return historySortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [historyData, historySortBy, historySortOrder]);

  const filterLabels: Record<string, string> = {
    date_from: 'Date From',
    date_to: 'Date To',
    product_id: 'Product',
    category_id: 'Category',
    brand: 'Brand',
    customer_id: 'Customer',
    sales_status: 'Sales Status',
    stock_status: 'Stock Status',
    payment_method: 'Payment Method',
    payment_status: 'Payment Status',
    sales_channel: 'Sales Channel',
    movement_type: 'Movement Type',
    search: 'Search',
  };

  const formatFilterValue = (key: string, value: any): string => {
    if (value === null || value === undefined || value === '') return '—';
    if (key === 'date_from' || key === 'date_to') {
      try { return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return String(value); }
    }
    return String(value);
  };

  const activeFilterCount = useMemo(() => {
    const vals = watchFilters();
    return Object.values(vals).filter((v) => v !== '' && v != null).length;
  }, [watchFilters()]);

  const formatHistoryStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (!isAdmin) {
    return <div className="p-6 text-red-600 text-sm">You do not have permission to access reports.</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Reports</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Generate and manage business reports</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <select
            value={selectedReportType}
            onChange={(e) => { setSelectedReportType(e.target.value as ReportType); setDataPage(1); }}
            className={`${inputClass} w-full md:w-64`}
          >
            {REPORT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <FilterIcon fontSize="small" />
            Filters {activeFilterCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px]">{activeFilterCount}</span>}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => handleGenerate('csv')}
            disabled={isGenerating || generateMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            <CsvIcon fontSize="small" /> Generate CSV
          </button>
          <button
            onClick={() => handleGenerate('pdf')}
            disabled={isGenerating || generateMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <PdfIcon fontSize="small" /> Generate PDF
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Date From</label>
              <input type="date" {...registerFilter('date_from')} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Date To</label>
              <input type="date" {...registerFilter('date_to')} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Product</label>
              <select {...registerFilter('product_id')} className={inputClass}>
                <option value="">All Products</option>
                {(products || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Category</label>
              <select {...registerFilter('category_id')} className={inputClass}>
                <option value="">All Categories</option>
                {(categories || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Customer</label>
              <select {...registerFilter('customer_id')} className={inputClass}>
                <option value="">All Customers</option>
                {(customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Sales Status</label>
              <select {...registerFilter('sales_status')} className={inputClass}>
                <option value="">All</option>
                <option value="COMPLETED">Completed</option>
                <option value="DRAFT">Draft</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Stock Status</label>
              <select {...registerFilter('stock_status')} className={inputClass}>
                <option value="">All</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Movement Type</label>
              <select {...registerFilter('movement_type')} className={inputClass}>
                <option value="">All</option>
                <option value="SALE">Sale</option>
                <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
                <option value="STOCK_ADDITION">Stock Addition</option>
                <option value="STOCK_REMOVAL">Stock Removal</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Search</label>
              <input type="text" {...registerFilter('search')} placeholder="Search..." className={inputClass} />
            </div>
             <div className="md:col-span-4 flex justify-end">
               <button onClick={clearFilters} className="inline-flex items-center gap-1 px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
                 <CloseIcon fontSize="small" /> Clear Filters
               </button>
             </div>
           </div>
         )}
       </div>

       {reportData && reportData.applied_filters && Object.keys(reportData.applied_filters).length > 0 && (
         <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
           <h3 className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Applied Filters</h3>
           <div className="flex flex-wrap gap-x-4 gap-y-1">
             {Object.entries(reportData.applied_filters).map(([key, value]) => (
               <span key={key} className="text-[11px] text-slate-700 dark:text-slate-300">
                 <span className="font-medium">{filterLabels[key] || key}:</span> {formatFilterValue(key, value)}
               </span>
             ))}
           </div>
           {reportData.period && (reportData.period.from || reportData.period.to) && (
             <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
               <span className="font-medium">Period:</span> {reportData.period.from ? formatFilterValue('date_from', reportData.period.from) : '...'} → {reportData.period.to ? formatFilterValue('date_to', reportData.period.to) : '...'}
             </div>
           )}
         </div>
       )}

       <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
         <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
           <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
             {REPORT_TYPE_OPTIONS.find((r) => r.value === selectedReportType)?.label || 'Report'} Data
           </h2>
          {reportData && (
            <div className="flex items-center gap-2">
              <button onClick={handleExportCSV} className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/30 rounded-lg hover:bg-emerald-100">
                <CsvIcon fontSize="small" /> CSV
              </button>
              <button onClick={handleExportPDF} className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/30 rounded-lg hover:bg-indigo-100">
                <PdfIcon fontSize="small" /> PDF
              </button>
            </div>
          )}
        </div>
        {reportLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading report data...</div>
        ) : reportData && sortedRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  {reportData.columns.map((col) => (
                    <th key={col} className="px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 select-none" onClick={() => handleSort(col)}>
                      {col.replace(/_/g, ' ')} <span className="text-slate-400">{getSortIndicator(col, sortBy, sortOrder)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {sortedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/30">
                    {reportData.columns.map((col) => (
                      <td key={col} className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {typeof row[col] === 'number' && (col.toLowerCase().includes('amount') || col.toLowerCase().includes('price') || col.toLowerCase().includes('revenue') || col.toLowerCase().includes('value'))
                          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row[col] as number)
                          : String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Total: {reportData.total_rows} rows</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setDataPage((p) => Math.max(1, p - 1))} disabled={dataPage <= 1} className="px-3 py-1 text-[10px] border border-slate-300 dark:border-slate-700 rounded disabled:opacity-50">Prev</button>
                <span className="text-[10px] text-slate-500">Page {dataPage}</span>
                <button onClick={() => setDataPage((p) => p + 1)} disabled={sortedRows.length < 20} className="px-3 py-1 text-[10px] border border-slate-300 dark:border-slate-700 rounded disabled:opacity-50">Next</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">No data available. Adjust your filters or generate a report.</div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Report History</h2>
        </div>
        {historyLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading history...</div>
        ) : historyData && sortedHistoryItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 select-none" onClick={() => handleHistorySort('report_name')}>Report Name {getSortIndicator('report_name', historySortBy, historySortOrder)}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 select-none" onClick={() => handleHistorySort('report_type')}>Type {getSortIndicator('report_type', historySortBy, historySortOrder)}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 select-none" onClick={() => handleHistorySort('export_format')}>Format {getSortIndicator('export_format', historySortBy, historySortOrder)}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 select-none" onClick={() => handleHistorySort('status')}>Status {getSortIndicator('status', historySortBy, historySortOrder)}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 select-none" onClick={() => handleHistorySort('generated_by_name')}>Generated By {getSortIndicator('generated_by_name', historySortBy, historySortOrder)}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 select-none" onClick={() => handleHistorySort('generated_at')}>Generated At {getSortIndicator('generated_at', historySortBy, historySortOrder)}</th>
                  <th className="px-4 py-3 font-medium">Applied Filters</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {sortedHistoryItems.map((item: ReportHistory) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/30">
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100 font-medium">{item.report_name}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 capitalize">{item.report_type.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 uppercase">{item.export_format}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${STATUS_STYLES[item.status] || STATUS_STYLES.pending}`}>
                        {formatHistoryStatus(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{item.generated_by_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{new Date(item.generated_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {item.filters && Object.keys(item.filters).length > 0 ? (
                        <span title={Object.entries(item.filters).filter(([,v]) => v).map(([k,v]) => `${filterLabels[k] || k}: ${v}`).join('\n')} className="cursor-help">
                          {Object.entries(item.filters).filter(([,v]) => v).length} filter(s)
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {item.status === 'completed' && (
                        <button
                          onClick={() => handleDownload(item.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/30 rounded hover:bg-indigo-100"
                        >
                          <DownloadIcon fontSize="small" /> Download
                        </button>
                      )}
                      {item.error_message && <span className="text-[10px] text-red-600 ml-2" title={item.error_message}>Error</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Total: {historyData.total} records</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setHistoryPage((p) => Math.max(1, p - 1))} disabled={historyPage <= 1} className="px-3 py-1 text-[10px] border border-slate-300 dark:border-slate-700 rounded disabled:opacity-50">Prev</button>
                <span className="text-[10px] text-slate-500">Page {historyPage}</span>
                <button onClick={() => setHistoryPage((p) => p + 1)} disabled={sortedHistoryItems.length < 10} className="px-3 py-1 text-[10px] border border-slate-300 dark:border-slate-700 rounded disabled:opacity-50">Next</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">No report history yet.</div>
        )}
      </div>
    </div>
  );
};

export default Reports;
