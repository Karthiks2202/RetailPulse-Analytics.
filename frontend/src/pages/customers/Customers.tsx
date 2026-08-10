import React, { useState } from 'react';
import { formatCurrency } from '../../utils/currency';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  activateCustomer,
  deactivateCustomer,
  getCustomerTimeline,
  getCustomerAnalyticsDashboard,
  getCustomerPurchaseDetail,
  getTopCustomers,
  getNewVsReturning,
  exportCustomersCSV,
  exportCustomersPDF,
  exportCustomerAnalyticsCSV,
  exportCustomerAnalyticsPDF,
  exportTopCustomersCSV,
  exportTopCustomersPDF,
  type Customer,
  type CustomerCreate,
  type CustomerPurchaseDetailResponse,
  type CustomerTimelineResponse,
} from '../../api/customerApi';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Block as BlockIcon,
  Receipt as ReceiptIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  BarChart as BarChartIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';

const inputClass =
  'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition-all';

interface CustomerFormValues {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  customer_type: 'RETAIL' | 'WHOLESALE' | 'CORPORATE';
  preferred_sales_channel: string;
  notes: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const StatusBadge: React.FC<{ status: 'ACTIVE' | 'INACTIVE' }> = ({ status }) => (
  <span
    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold capitalize tracking-wide ${
      status === 'ACTIVE'
        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
    }`}
  >
    {status.toLowerCase()}
  </span>
);

const AnalyticsCard: React.FC<{ title: string; value: string | number; subtitle?: string; color: string }> = ({ title, value, subtitle, color }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{title}</p>
    <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1" style={{ color }}>{value}</p>
    {subtitle && <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{subtitle}</p>}
  </div>
);

const NewVsReturningSection: React.FC = () => {
  return <div>test</div>;
};

const Customers: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'first_name' | 'last_name' | 'customer_type' | 'total_spent' | 'total_orders' | 'last_purchase_date' | 'customer_since' | 'name'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [historyDetail, setHistoryDetail] = useState<CustomerPurchaseDetailResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineCustomer, setTimelineCustomer] = useState<Customer | null>(null);
  const [timelineItems, setTimelineItems] = useState<CustomerTimelineResponse[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const [analyticsTab, setAnalyticsTab] = useState<'overview' | 'top' | 'behavior'>('overview');
  const [showAnalytics, setShowAnalytics] = useState(false);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['customer-analytics-dashboard'],
    queryFn: getCustomerAnalyticsDashboard,
    enabled: showAnalytics,
  });

  const { data: topCustomers = [] } = useQuery({
    queryKey: ['top-customers', 10],
    queryFn: () => getTopCustomers(10),
    enabled: showAnalytics,
  });

  const { data: customers = [], isLoading, isError } = useQuery({
    queryKey: ['customers', { search, statusFilter, customerTypeFilter, segmentFilter, cityFilter, stateFilter, countryFilter, dateFrom, dateTo, sortBy, sortDir }],
    queryFn: () =>
      getCustomers({
        search: search || undefined,
        status: statusFilter || undefined,
        customer_type: customerTypeFilter || undefined,
        segment: segmentFilter || undefined,
        city: cityFilter || undefined,
        state: stateFilter || undefined,
        country: countryFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      }),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      date_of_birth: '',
      gender: '',
      address: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      customer_type: 'RETAIL',
      preferred_sales_channel: '',
      notes: '',
      status: 'ACTIVE',
    },
  });

  const openCreate = () => {
    setEditing(null);
    setModalError(null);
    reset({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      date_of_birth: '',
      gender: '',
      address: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      customer_type: 'RETAIL',
      preferred_sales_channel: '',
      notes: '',
      status: 'ACTIVE',
    });
    setModalOpen(true);
  };

  const openEdit = (cust: Customer) => {
    setEditing(cust);
    setModalError(null);
    setValue('first_name', cust.first_name);
    setValue('last_name', cust.last_name);
    setValue('email', cust.email || '');
    setValue('phone', cust.phone || '');
    setValue('date_of_birth', cust.date_of_birth ? new Date(cust.date_of_birth).toISOString().split('T')[0] : '');
    setValue('gender', (cust as any).gender || '');
    setValue('address', cust.address || '');
    setValue('city', cust.city || '');
    setValue('state', cust.state || '');
    setValue('postal_code', cust.postal_code || '');
    setValue('country', cust.country || '');
    setValue('customer_type', (cust as any).customer_type || 'RETAIL');
    setValue('preferred_sales_channel', (cust as any).preferred_sales_channel || '');
    setValue('notes', cust.notes || '');
    setValue('status', cust.status);
    setModalOpen(true);
  };

  const mutation = useMutation({
    mutationFn: (values: CustomerFormValues) => {
      const payload: CustomerCreate = {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email || undefined,
        phone: values.phone || undefined,
        date_of_birth: values.date_of_birth || undefined,
        gender: values.gender || undefined,
        address: values.address || undefined,
        city: values.city || undefined,
        state: values.state || undefined,
        postal_code: values.postal_code || undefined,
        country: values.country || undefined,
        customer_type: values.customer_type,
        preferred_sales_channel: values.preferred_sales_channel || undefined,
        notes: values.notes || undefined,
        status: values.status,
};

      return editing ? updateCustomer(editing.id, payload) : createCustomer(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-analytics-summary'] });
      queryClient.invalidateQueries({ queryKey: ['top-customers'] });
      showNotification(editing ? 'Customer updated successfully' : 'Customer created successfully', 'success');
      setModalError(null);
      setModalOpen(false);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Failed to save customer.';
      setModalError(msg);
      showNotification(msg, 'error');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      showNotification('Customer deleted successfully', 'success');
    },
    onError: (err: any) => {
      showNotification(err?.response?.data?.detail || err?.response?.data?.error || 'Failed to delete customer', 'error');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (cust: Customer) =>
      cust.status === 'ACTIVE' ? deactivateCustomer(cust.id) : activateCustomer(cust.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-analytics-summary'] });
      showNotification('Customer status updated', 'success');
    },
    onError: (err: any) => {
      showNotification(err?.response?.data?.detail || err?.response?.data?.error || 'Failed to update status', 'error');
    },
  });

  const handleExportCSV = async () => {
    try {
      const res = await exportCustomersCSV({ status: statusFilter || undefined, customer_type: customerTypeFilter || undefined, search: search || undefined });
      const blob = new Blob([res.content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', res.filename || 'customers.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('Customers exported as CSV', 'success');
    } catch (err: any) {
      showNotification(err?.response?.data?.detail || 'Failed to export CSV', 'error');
    }
  };

  const handleExportPDF = async () => {
    try {
      const res = await exportCustomersPDF({ status: statusFilter || undefined, customer_type: customerTypeFilter || undefined, search: search || undefined });
      
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Customers Report', 14, 15);
      
      // Check if content exists and is an array
      const data = Array.isArray(res.content) ? res.content : [];
      if (data.length === 0) {
        showNotification('No data to export', 'error');
        return;
      }
      
      // Extract headers from the first row keys
      const headers = Object.keys(data[0]);
      
      // Map data to array of arrays for autotable
      const body = data.map((row: any) => headers.map(key => String(row[key] !== null && row[key] !== undefined ? row[key] : '')));
      
      autoTable(doc, {
        head: [headers],
        body: body,
        startY: 20,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [16, 185, 129] } // Emerald 500
      });
      
      doc.save(res.filename || 'customers.pdf');
      showNotification('Customers exported as PDF', 'success');
    } catch (err: any) {
      showNotification(err?.response?.data?.detail || 'Failed to export PDF', 'error');
    }
  };

  const handleExportAnalyticsCSV = async () => {
    try {
      const res = await exportCustomerAnalyticsCSV();
      const blob = new Blob([res.content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', res.filename || 'customer_analytics_report.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('Customer analytics exported as CSV', 'success');
    } catch (err: any) {
      showNotification(err?.response?.data?.detail || 'Failed to export analytics CSV', 'error');
    }
  };

  const handleExportAnalyticsPDF = async () => {
    try {
      const res = await exportCustomerAnalyticsPDF();
      showNotification(res.message || 'Customer analytics PDF generated', 'success');
    } catch (err: any) {
      showNotification(err?.response?.data?.detail || 'Failed to export analytics PDF', 'error');
    }
  };

  const handleExportTopCustomersCSV = async () => {
    try {
      const res = await exportTopCustomersCSV();
      const blob = new Blob([res.content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', res.filename || 'top_customers_report.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('Top customers exported as CSV', 'success');
    } catch (err: any) {
      showNotification(err?.response?.data?.detail || 'Failed to export top customers CSV', 'error');
    }
  };

  const handleExportTopCustomersPDF = async () => {
    try {
      const res = await exportTopCustomersPDF();
      showNotification(res.message || 'Top customers PDF generated', 'success');
    } catch (err: any) {
      showNotification(err?.response?.data?.detail || 'Failed to export top customers PDF', 'error');
    }
  };

  const onSubmit = (values: CustomerFormValues) => {
    setModalError(null);
    mutation.mutate(values);
  };

  const confirmDelete = (cust: Customer) => {
    if (window.confirm(`Delete customer "${cust.first_name} ${cust.last_name}"? This cannot be undone.`)) {
      removeMutation.mutate(cust.id);
    }
  };

  const openHistory = async (cust: Customer) => {
    setHistoryCustomer(cust);
    setHistoryLoading(true);
    setHistoryOpen(true);
    try {
      const detail = await getCustomerPurchaseDetail(cust.id, 10, 5);
      setHistoryDetail(detail);
    } catch {
      showNotification('Failed to load purchase details', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openTimeline = async (cust: Customer) => {
    setTimelineCustomer(cust);
    setTimelineLoading(true);
    setTimelineOpen(true);
    try {
      const items = await getCustomerTimeline(cust.id, { limit: 50 });
      setTimelineItems(items);
    } catch {
      showNotification('Failed to load timeline', 'error');
    } finally {
      setTimelineLoading(false);
    }
  };

  const fullName = (c: Customer) => `${c.first_name} ${c.last_name}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Customers</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Manage your customer base and track purchase behavior.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide border transition-all ${
              showAnalytics
                ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/40'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <BarChartIcon style={{ fontSize: 17 }} />
            Analytics
          </button>
          {isAdmin && (
            <>
              <button
                onClick={handleExportCSV}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold tracking-wide border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                <span className="text-emerald-600">CSV</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold tracking-wide border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                <span className="text-rose-600">PDF</span>
              </button>
              <button
                onClick={openCreate}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold tracking-wide shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}
              >
                <AddIcon style={{ fontSize: 17 }} />
                New Customer
              </button>
            </>
          )}
        </div>
      </div>

      {showAnalytics && dashboard && !dashboardLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnalyticsCard title="Total Customers" value={dashboard.total_customers.toString()} subtitle={`${dashboard.active_customers} active`} color="#4f46e5" />
          <AnalyticsCard title="New Customers" value={dashboard.new_customers.toString()} subtitle="New this month" color="#059669" />
          <AnalyticsCard title="Returning Customers" value={dashboard.returning_customers.toString()} subtitle="With repeat purchases" color="#7c3aed" />
          <AnalyticsCard title="Total Revenue" value={formatCurrency(dashboard.total_revenue)} subtitle="From linked sales" color="#d97706" />
          <AnalyticsCard title="Avg Spend" value={formatCurrency(dashboard.average_customer_spend)} subtitle="Per active customer" color="#0891b2" />
          <AnalyticsCard title="Avg Purchase Freq" value={`${dashboard.average_purchase_frequency.toFixed(1)}x`} subtitle="Orders per customer" color="#dc2626" />
        </div>
      )}

      {showAnalytics && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              {(['overview', 'top', 'behavior'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setAnalyticsTab(t)}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                    analyticsTab === t
                      ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {t === 'overview' ? 'Overview' : t === 'top' ? 'Top Customers' : 'New vs Returning'}
                </button>
              ))}
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button onClick={handleExportAnalyticsCSV} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-emerald-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Analytics CSV</button>
                <button onClick={handleExportAnalyticsPDF} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-rose-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Analytics PDF</button>
                <button onClick={handleExportTopCustomersCSV} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-emerald-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Top CSV</button>
                <button onClick={handleExportTopCustomersPDF} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-rose-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Top PDF</button>
              </div>
            )}
          </div>
          <div className="p-6">
            {analyticsTab === 'overview' && dashboard && !dashboardLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <AnalyticsCard title="Total Customers" value={dashboard.total_customers.toString()} subtitle={`${dashboard.active_customers} active, ${dashboard.total_customers - dashboard.active_customers} inactive`} color="#4f46e5" />
                <AnalyticsCard title="New Customers" value={dashboard.new_customers.toString()} subtitle="New this month" color="#059669" />
                <AnalyticsCard title="Returning Customers" value={dashboard.returning_customers.toString()} subtitle="With repeat purchases" color="#7c3aed" />
                <AnalyticsCard title="Total Revenue" value={formatCurrency(dashboard.total_revenue)} subtitle="From linked sales" color="#d97706" />
                <AnalyticsCard title="Avg Spend" value={formatCurrency(dashboard.average_customer_spend)} subtitle="Per active customer" color="#0891b2" />
                <AnalyticsCard title="Avg Purchase Freq" value={`${dashboard.average_purchase_frequency.toFixed(1)}x`} subtitle="Orders per customer" color="#dc2626" />
              </div>
            )}
            {analyticsTab === 'overview' && dashboardLoading && (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
              </div>
            )}
            {analyticsTab === 'top' && (
              <div className="overflow-x-auto">
                {topCustomers.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No customer data yet. Link sales to customers to see rankings.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <th className="px-4 py-3 font-bold">Customer</th>
                        <th className="px-4 py-3 font-bold">Purchases</th>
                        <th className="px-4 py-3 font-bold">Total Spent</th>
                        <th className="px-4 py-3 font-bold">Last Purchase</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCustomers.map((c) => (
                        <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800/60">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold">
                                {c.first_name.charAt(0)}{c.last_name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-800 dark:text-slate-100">{c.first_name} {c.last_name}</div>
                                <div className="text-[10px] text-slate-400">{c.email || '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.total_purchases}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(c.total_spent)}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.last_purchase_date ? new Date(c.last_purchase_date).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            {analyticsTab === 'behavior' && (
              <NewVsReturningSection />
            )}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center gap-3 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 18 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone or location..."
              className={`w-full ${inputClass} pl-10`}
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} lg:w-36`}>
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select value={customerTypeFilter} onChange={(e) => setCustomerTypeFilter(e.target.value)} className={`${inputClass} lg:w-36`}>
            <option value="">All Types</option>
            <option value="RETAIL">Retail</option>
            <option value="WHOLESALE">Wholesale</option>
            <option value="CORPORATE">Corporate</option>
          </select>
          <select value={segmentFilter} onChange={(e) => setSegmentFilter(e.target.value)} className={`${inputClass} lg:w-36`}>
            <option value="">All Segments</option>
            <option value="NEW">New</option>
            <option value="REGULAR">Regular</option>
            <option value="LOYAL">Loyal</option>
            <option value="VIP">VIP</option>
          </select>
          <input
            type="text"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            placeholder="City"
            className={`${inputClass} lg:w-36`}
          />
          <input
            type="text"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            placeholder="State"
            className={`${inputClass} lg:w-36`}
          />
          <input
            type="text"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            placeholder="Country"
            className={`${inputClass} lg:w-36`}
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From"
            className={`${inputClass} lg:w-40`}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To"
            className={`${inputClass} lg:w-40`}
          />
          <select
            value={`${sortBy}-${sortDir}`}
            onChange={(e) => {
              const [s, d] = e.target.value.split('-');
              setSortBy(s as any);
              setSortDir(d as any);
            }}
            className={`${inputClass} lg:w-48`}
          >
            <option value="created_at-desc">Recently Added</option>
            <option value="first_name-asc">Name (A-Z)</option>
            <option value="last_name-asc">Surname (A-Z)</option>
            <option value="customer_type-asc">Type (A-Z)</option>
            <option value="total_spent-desc">Total Spent (High-Low)</option>
            <option value="total_orders-desc">Total Orders (High-Low)</option>
            <option value="last_purchase_date-desc">Last Purchase (Recent)</option>
            <option value="customer_since-asc">Customer Since (Oldest)</option>
            <option value="name-asc">Full Name (A-Z)</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          </div>
        ) : isError ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-red-600 font-medium">Failed to load customers.</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-6">
            <PeopleIcon className="text-slate-300 dark:text-slate-700" style={{ fontSize: 48 }} />
            <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-400">No customers found</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Add your first customer to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-3 font-bold">Customer Name</th>
                  <th className="px-6 py-3 font-bold">Email</th>
                  <th className="px-6 py-3 font-bold">Phone</th>
                  <th className="px-6 py-3 font-bold">Segment</th>
                  <th className="px-6 py-3 font-bold">Total Purchases</th>
                  <th className="px-6 py-3 font-bold">Total Spend</th>
                  <th className="px-6 py-3 font-bold">Status</th>
                  {isAdmin && <th className="px-6 py-3 font-bold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {customers.map((cust) => (
                  <tr key={cust.id} className="group border-b border-slate-100 dark:border-slate-800/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-bold text-slate-800 dark:text-slate-100">{fullName(cust)}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{cust.email || '—'}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{cust.phone || '—'}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      <div className="font-semibold capitalize">{(cust as any).segment?.toLowerCase() || '—'}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{cust.total_purchases}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(cust.total_spent)}</td>
                    <td className="px-6 py-4"><StatusBadge status={cust.status} /></td>
                    {isAdmin && (
                      <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openTimeline(cust)}
                          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
                          title="Timeline"
                        >
                          <TrendingUpIcon style={{ fontSize: 16 }} />
                        </button>
                        <button
                          onClick={() => openHistory(cust)}
                          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
                          title="Purchase History"
                        >
                          <ReceiptIcon style={{ fontSize: 16 }} />
                        </button>
                          <button
                            onClick={() => toggleMutation.mutate(cust)}
                            className={`p-2 rounded-lg border transition-all ${
                              cust.status === 'ACTIVE'
                                ? 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 hover:border-amber-300 dark:hover:border-amber-800'
                                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 dark:hover:border-emerald-800'
                            }`}
                            title={cust.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          >
                            {cust.status === 'ACTIVE' ? <BlockIcon style={{ fontSize: 16 }} /> : <CheckIcon style={{ fontSize: 16 }} />}
                          </button>
                          <button
                            onClick={() => openEdit(cust)}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
                            title="Edit"
                          >
                            <EditIcon style={{ fontSize: 16 }} />
                          </button>
                          <button
                            onClick={() => confirmDelete(cust)}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 hover:border-red-300 dark:hover:border-red-800 transition-all"
                            title="Delete"
                          >
                            <DeleteIcon style={{ fontSize: 16 }} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-modal-enter">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  {editing ? 'Edit Customer' : 'New Customer'}
                </h2>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  {editing ? 'Update customer information' : 'Add a new customer to your database'}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <CloseIcon style={{ fontSize: 20 }} />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              {modalError && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 text-xs font-medium px-4 py-3 rounded-lg">
                  {modalError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">First Name</label>
                  <input {...register('first_name')} className={`${inputClass} w-full`} placeholder="First name" />
                  {errors.first_name && <p className="text-red-500 text-[10px] mt-1">{errors.first_name.message}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Last Name</label>
                  <input {...register('last_name')} className={`${inputClass} w-full`} placeholder="Last name" />
                  {errors.last_name && <p className="text-red-500 text-[10px] mt-1">{errors.last_name.message}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Email</label>
                  <input type="email" {...register('email')} className={`${inputClass} w-full`} placeholder="email@example.com" />
                  {errors.email && <p className="text-red-500 text-[10px] mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Phone</label>
                  <input {...register('phone')} className={`${inputClass} w-full`} placeholder="+1 234 567 8900" />
                  {errors.phone && <p className="text-red-500 text-[10px] mt-1">{errors.phone.message}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Date of Birth</label>
                  <input type="date" {...register('date_of_birth')} className={`${inputClass} w-full`} />
                  {errors.date_of_birth && <p className="text-red-500 text-[10px] mt-1">{errors.date_of_birth.message}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Gender</label>
                  <select {...register('gender')} className={`${inputClass} w-full`}>
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                  {errors.gender && <p className="text-red-500 text-[10px] mt-1">{errors.gender.message}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Address</label>
                  <input {...register('address')} className={`${inputClass} w-full`} placeholder="Street address" />
                  {errors.address && <p className="text-red-500 text-[10px] mt-1">{errors.address.message}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">City</label>
                  <input {...register('city')} className={`${inputClass} w-full`} placeholder="City" />
                  {errors.city && <p className="text-red-500 text-[10px] mt-1">{errors.city.message}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">State</label>
                  <input {...register('state')} className={`${inputClass} w-full`} placeholder="State" />
                  {errors.state && <p className="text-red-500 text-[10px] mt-1">{errors.state.message}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Postal Code</label>
                  <input {...register('postal_code')} className={`${inputClass} w-full`} placeholder="Postal code" />
                  {errors.postal_code && <p className="text-red-500 text-[10px] mt-1">{errors.postal_code.message}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Country</label>
                  <input {...register('country')} className={`${inputClass} w-full`} placeholder="Country" />
                  {errors.country && <p className="text-red-500 text-[10px] mt-1">{errors.country.message}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Customer Type</label>
                  <select {...register('customer_type')} className={`${inputClass} w-full`}>
                    <option value="RETAIL">Retail</option>
                    <option value="WHOLESALE">Wholesale</option>
                    <option value="CORPORATE">Corporate</option>
                  </select>
                  {errors.customer_type && <p className="text-red-500 text-[10px] mt-1">{errors.customer_type.message}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Preferred Sales Channel</label>
                  <input {...register('preferred_sales_channel')} className={`${inputClass} w-full`} placeholder="e.g. Online, In-store" />
                  {errors.preferred_sales_channel && <p className="text-red-500 text-[10px] mt-1">{errors.preferred_sales_channel.message}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Status</label>
                  <select {...register('status')} className={`${inputClass} w-full`}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                  {errors.status && <p className="text-red-500 text-[10px] mt-1">{errors.status.message}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Notes</label>
                  <textarea {...register('notes')} className={`${inputClass} w-full`} rows={3} placeholder="Optional notes about this customer" />
                  {errors.notes && <p className="text-red-500 text-[10px] mt-1">{errors.notes.message}</p>}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={mutation.isPending} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  {mutation.isPending ? 'Saving...' : editing ? 'Update Customer' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-modal-enter">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Purchase Details
                </h2>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  {historyCustomer ? `${historyCustomer.first_name} ${historyCustomer.last_name}` : ''}
                </p>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <CloseIcon style={{ fontSize: 20 }} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {historyLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
                </div>
              ) : !historyDetail ? (
                <div className="text-center py-12">
                  <ReceiptIcon className="text-slate-300 dark:text-slate-700 mx-auto" style={{ fontSize: 40 }} />
                  <p className="mt-3 text-xs text-slate-500 font-medium">No purchase details available</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Orders</p>
                      <p className="text-lg font-extrabold text-slate-900 dark:text-white">{historyDetail.total_orders}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Revenue</p>
                      <p className="text-lg font-extrabold text-slate-900 dark:text-white">{formatCurrency(historyDetail.total_revenue)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Qty Purchased</p>
                      <p className="text-lg font-extrabold text-slate-900 dark:text-white">{historyDetail.total_quantity_purchased}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Order Value</p>
                      <p className="text-lg font-extrabold text-slate-900 dark:text-white">{formatCurrency(historyDetail.average_order_value)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">First Purchase</p>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mt-1">
                        {historyDetail.first_purchase_date ? new Date(historyDetail.first_purchase_date).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Purchase</p>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 mt-1">
                        {historyDetail.last_purchase_date ? new Date(historyDetail.last_purchase_date).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>

                  {historyDetail.frequently_purchased_products.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Frequently Purchased Products</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                              <th className="px-3 py-2 font-bold">Product</th>
                              <th className="px-3 py-2 font-bold">SKU</th>
                              <th className="px-3 py-2 font-bold text-right">Qty</th>
                              <th className="px-3 py-2 font-bold text-right">Revenue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyDetail.frequently_purchased_products.map((product) => (
                              <tr key={product.product_id} className="border-b border-slate-100 dark:border-slate-800/60">
                                <td className="px-3 py-2 text-slate-800 dark:text-slate-100 font-semibold">{product.product_name}</td>
                                <td className="px-3 py-2 font-mono text-xs text-slate-500">{product.sku}</td>
                                <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{product.total_quantity_purchased}</td>
                                <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(product.total_revenue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Recent Transactions</h3>
                    {historyDetail.recent_transactions.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No transactions found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                              <th className="px-3 py-2 font-bold">Invoice</th>
                              <th className="px-3 py-2 font-bold">Date</th>
                              <th className="px-3 py-2 font-bold">Channel</th>
                              <th className="px-3 py-2 font-bold">Payment</th>
                              <th className="px-3 py-2 font-bold">Status</th>
                              <th className="px-3 py-2 font-bold text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyDetail.recent_transactions.map((item) => (
                              <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/60">
                                <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">{item.invoice_number}</td>
                                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{new Date(item.sale_date).toLocaleDateString()}</td>
                                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{item.sales_channel}</td>
                                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{item.payment_method}</td>
                                <td className="px-3 py-2"><StatusBadge status={item.status as any} /></td>
                                <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(item.total_amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {timelineOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-modal-enter">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Customer Timeline
                </h2>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  {timelineCustomer ? `${timelineCustomer.first_name} ${timelineCustomer.last_name}` : ''}
                </p>
              </div>
              <button onClick={() => setTimelineOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <CloseIcon style={{ fontSize: 20 }} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {timelineLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
                </div>
              ) : timelineItems.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-xs text-slate-500 font-medium">No timeline events found.</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-800" />
                  <div className="space-y-4">
                    {timelineItems.map((item) => (
                      <div key={item.id} className="flex gap-4">
                        <div className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-50 dark:ring-indigo-900/30 shrink-0 relative z-10" />
                        <div className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.action}</p>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {new Date(item.timestamp).toLocaleString()}
                            </span>
                          </div>
                          {item.details && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{item.details}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
