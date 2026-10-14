import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  getScheduledReports,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  type ScheduledReport,
  type ScheduledReportUpdate,
  type ReportType,
  type ReportFrequency,
  type ReportFormat,
} from '../../api/reportApi';
import { getCategories } from '../../api/categoryApi';
import { getProducts } from '../../api/productApi';
import { getCustomers } from '../../api/customerApi';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
} from '@mui/icons-material';

const inputClass =
  'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition-all';

const REPORT_TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: 'sales', label: 'Sales Report' },
  { value: 'inventory', label: 'Inventory Report' },
  { value: 'customer', label: 'Customer Report' },
  { value: 'product_performance', label: 'Product Performance Report' },
  { value: 'stock_movement', label: 'Stock Movement Report' },
];

const FREQUENCY_OPTIONS: { value: ReportFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const FORMAT_OPTIONS: { value: ReportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'pdf', label: 'PDF' },
];

interface ScheduledReportFormValues {
  name: string;
  report_type: ReportType;
  frequency: ReportFrequency;
  execution_time: string;
  recipients: string;
  export_format: ReportFormat;
  is_active: boolean;
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

const emptyFormValues: ScheduledReportFormValues = {
  name: '',
  report_type: 'sales',
  frequency: 'daily',
  execution_time: '08:00',
  recipients: '',
  export_format: 'csv',
  is_active: true,
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
};

const ScheduledReports: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'ANALYST';

  const [page, setPage] = useState(1);
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ScheduledReportFormValues>({ defaultValues: emptyFormValues });

  const { data, isLoading } = useQuery({
    queryKey: ['scheduledReports', page, filterActive],
    queryFn: () => getScheduledReports({ page, page_size: 20, is_active: filterActive }),
    enabled: isAdmin,
  });

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => getCategories(), enabled: isAdmin });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => getProducts({ status: 'ACTIVE' }), enabled: isAdmin });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => getCustomers({ status: 'ACTIVE' }), enabled: isAdmin });

  const createMutation = useMutation({
    mutationFn: createScheduledReport,
    onSuccess: () => {
      showNotification('Scheduled report created', 'success');
      setModalOpen(false);
      setEditingReport(null);
      reset(emptyFormValues);
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
    },
    onError: (error: any) => {
      showNotification(error?.response?.data?.detail || 'Failed to create scheduled report', 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ScheduledReportUpdate }) => updateScheduledReport(id, payload),
    onSuccess: () => {
      showNotification('Scheduled report updated', 'success');
      setModalOpen(false);
      setEditingReport(null);
      reset(emptyFormValues);
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
    },
    onError: (error: any) => {
      showNotification(error?.response?.data?.detail || 'Failed to update scheduled report', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteScheduledReport,
    onSuccess: () => {
      showNotification('Scheduled report deleted', 'success');
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
    },
    onError: (error: any) => {
      showNotification(error?.response?.data?.detail || 'Failed to delete scheduled report', 'error');
    },
  });

  const buildFilters = (values: ScheduledReportFormValues) => {
    const filters: Record<string, any> = {};
    if (values.date_from) filters.date_from = values.date_from;
    if (values.date_to) filters.date_to = values.date_to;
    if (values.product_id) filters.product_id = values.product_id;
    if (values.category_id) filters.category_id = values.category_id;
    if (values.brand) filters.brand = values.brand;
    if (values.customer_id) filters.customer_id = values.customer_id;
    if (values.sales_status) filters.sales_status = values.sales_status;
    if (values.stock_status) filters.stock_status = values.stock_status;
    if (values.payment_method) filters.payment_method = values.payment_method;
    if (values.payment_status) filters.payment_status = values.payment_status;
    if (values.sales_channel) filters.sales_channel = values.sales_channel;
    if (values.movement_type) filters.movement_type = values.movement_type;
    if (values.search) filters.search = values.search;
    return filters;
  };

  const openCreate = () => {
    setEditingReport(null);
    reset(emptyFormValues);
    setModalOpen(true);
  };

  const openEdit = (report: ScheduledReport) => {
    setEditingReport(report);
    setValue('name', report.name);
    setValue('report_type', report.report_type);
    setValue('frequency', report.frequency);
    setValue('execution_time', report.execution_time);
    setValue('recipients', (report.recipients || []).join(', '));
    setValue('export_format', report.export_format);
    setValue('is_active', report.is_active);
    const filters = report.filters || {};
    setValue('date_from', filters.date_from || '');
    setValue('date_to', filters.date_to || '');
    setValue('product_id', filters.product_id || '');
    setValue('category_id', filters.category_id || '');
    setValue('brand', filters.brand || '');
    setValue('customer_id', filters.customer_id || '');
    setValue('sales_status', filters.sales_status || '');
    setValue('stock_status', filters.stock_status || '');
    setValue('payment_method', filters.payment_method || '');
    setValue('payment_status', filters.payment_status || '');
    setValue('sales_channel', filters.sales_channel || '');
    setValue('movement_type', filters.movement_type || '');
    setValue('search', filters.search || '');
    setModalOpen(true);
  };

  const onSubmit = (values: ScheduledReportFormValues) => {
    const recipients = values.recipients.split(',').map((r) => r.trim()).filter(Boolean);
    if (recipients.length === 0) {
      showNotification('At least one recipient email is required', 'error');
      return;
    }
    const filters = buildFilters(values);
    if (editingReport) {
      updateMutation.mutate({
        id: editingReport.id,
        payload: {
          name: values.name,
          report_type: values.report_type,
          frequency: values.frequency,
          execution_time: values.execution_time,
          recipients,
          export_format: values.export_format,
          is_active: values.is_active,
          filters,
        },
      });
    } else {
      createMutation.mutate({
        name: values.name,
        report_type: values.report_type,
        frequency: values.frequency,
        execution_time: values.execution_time,
        recipients,
        export_format: values.export_format,
        is_active: values.is_active,
        filters,
      });
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this scheduled report?')) {
      deleteMutation.mutate(id);
    }
  };

  const toggleActive = (report: ScheduledReport) => {
    updateMutation.mutate({
      id: report.id,
      payload: { is_active: !report.is_active },
    });
  };

  if (!isAdmin) {
    return <div className="p-6 text-red-600 text-sm">You do not have permission to access scheduled reports.</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Scheduled Reports</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Create and manage recurring report schedules</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <AddIcon fontSize="small" /> New Schedule
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <button
            onClick={() => setFilterActive(undefined)}
            className={`px-3 py-1.5 text-[10px] font-medium rounded-lg border ${filterActive === undefined ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilterActive(true)}
            className={`px-3 py-1.5 text-[10px] font-medium rounded-lg border ${filterActive === true ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterActive(false)}
            className={`px-3 py-1.5 text-[10px] font-medium rounded-lg border ${filterActive === false ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
          >
            Inactive
          </button>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading scheduled reports...</div>
        ) : data && data.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Report Type</th>
                  <th className="px-4 py-3 font-medium">Frequency</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Format</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last Run</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.items.map((report: ScheduledReport) => (
                  <tr key={report.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/30">
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100 font-medium">{report.name}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 capitalize">{report.report_type.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 capitalize">{report.frequency}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{report.execution_time}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 uppercase">{report.export_format}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${report.is_active ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-950/30 text-slate-700 dark:text-slate-400'}`}>
                        {report.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {report.last_run_at ? new Date(report.last_run_at).toLocaleString() : 'Never'}
                      {report.last_run_status && <span className={`ml-2 text-[10px] ${report.last_run_status === 'completed' ? 'text-emerald-600' : 'text-red-600'}`}>({report.last_run_status})</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleActive(report)} title={report.is_active ? 'Pause' : 'Resume'} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {report.is_active ? <PauseIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
                        </button>
                        <button onClick={() => openEdit(report)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
                          <EditIcon fontSize="small" />
                        </button>
                        <button onClick={() => handleDelete(report.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600">
                          <DeleteIcon fontSize="small" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Total: {data.total} schedules</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 text-[10px] border border-slate-300 dark:border-slate-700 rounded disabled:opacity-50">Prev</button>
                <span className="text-[10px] text-slate-500">Page {page}</span>
                <button onClick={() => setPage((p) => p + 1)} disabled={data.items.length < 20} className="px-3 py-1 text-[10px] border border-slate-300 dark:border-slate-700 rounded disabled:opacity-50">Next</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">No scheduled reports found. Create one to get started.</div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{editingReport ? 'Edit Scheduled Report' : 'New Scheduled Report'}</h3>
              <button onClick={() => { setModalOpen(false); setEditingReport(null); reset(emptyFormValues); }} className="text-slate-400 hover:text-slate-600">
                <CloseIcon fontSize="small" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Name</label>
                <input {...register('name', { required: 'Name is required' })} className={inputClass} placeholder="Weekly Sales Report" />
                {errors.name && <span className="text-[10px] text-red-600">{errors.name.message}</span>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Report Type</label>
                  <select {...register('report_type')} className={inputClass}>
                    {REPORT_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Frequency</label>
                  <select {...register('frequency')} className={inputClass}>
                    {FREQUENCY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Execution Time</label>
                  <input type="time" {...register('execution_time')} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Export Format</label>
                  <select {...register('export_format')} className={inputClass}>
                    {FORMAT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Recipients (comma-separated emails)</label>
                <input {...register('recipients', { required: 'At least one recipient is required' })} className={inputClass} placeholder="user@example.com, admin@example.com" />
                {errors.recipients && <span className="text-[10px] text-red-600">{errors.recipients.message}</span>}
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-3">
                <h4 className="text-[10px] uppercase tracking-wider text-slate-500">Report Filters</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Date From</label>
                    <input type="date" {...register('date_from')} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Date To</label>
                    <input type="date" {...register('date_to')} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Product</label>
                    <select {...register('product_id')} className={inputClass}>
                      <option value="">All Products</option>
                      {(products || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Category</label>
                    <select {...register('category_id')} className={inputClass}>
                      <option value="">All Categories</option>
                      {(categories || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Customer</label>
                    <select {...register('customer_id')} className={inputClass}>
                      <option value="">All Customers</option>
                      {(customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Sales Status</label>
                    <select {...register('sales_status')} className={inputClass}>
                      <option value="">All</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="DRAFT">Draft</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Stock Status</label>
                    <select {...register('stock_status')} className={inputClass}>
                      <option value="">All</option>
                      <option value="IN_STOCK">In Stock</option>
                      <option value="LOW_STOCK">Low Stock</option>
                      <option value="OUT_OF_STOCK">Out of Stock</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Brand</label>
                    <input type="text" {...register('brand')} className={inputClass} placeholder="Any brand" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Payment Method</label>
                    <select {...register('payment_method')} className={inputClass}>
                      <option value="">All</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Payment Status</label>
                    <select {...register('payment_status')} className={inputClass}>
                      <option value="">All</option>
                      <option value="PAID">Paid</option>
                      <option value="PENDING">Pending</option>
                      <option value="PARTIAL">Partial</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Sales Channel</label>
                    <select {...register('sales_channel')} className={inputClass}>
                      <option value="">All</option>
                      <option value="Retail Store">Retail Store</option>
                      <option value="Online Store">Online Store</option>
                      <option value="Marketplace">Marketplace</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Movement Type</label>
                    <select {...register('movement_type')} className={inputClass}>
                      <option value="">All</option>
                      <option value="SALE">Sale</option>
                      <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
                      <option value="STOCK_ADDITION">Stock Addition</option>
                      <option value="STOCK_REMOVAL">Stock Removal</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Search</label>
                    <input type="text" {...register('search')} className={inputClass} placeholder="Search..." />
                  </div>
                  <div />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active" {...register('is_active')} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <label htmlFor="is_active" className="text-xs text-slate-700 dark:text-slate-300">Active</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setModalOpen(false); setEditingReport(null); reset(emptyFormValues); }} className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {editingReport ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduledReports;
