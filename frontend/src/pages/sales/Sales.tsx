import React, { useState } from 'react';
import { formatCurrency } from '../../utils/currency';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  getSales,
  getSale,
  createSale,
  updateSale,
  deleteSale,
  exportSalesCSV,
  exportSalesPDF,
  type SaleCreate,
  type SaleUpdate,
  type SaleListItem,
  type SalesChannel,
  type PaymentMethod,
} from '../../api/saleApi';
import { getCustomers, type Customer as CustomerType } from '../../api/customerApi';
import type { Product } from '../../api/productApi';
import { useNavigate } from 'react-router-dom';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  ShoppingCart as CartIcon,
  Visibility as ViewIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
} from '@mui/icons-material';

const CHANNEL_OPTIONS: SalesChannel[] = ['Retail Store', 'Online Store', 'Marketplace'];
const PAYMENT_OPTIONS: PaymentMethod[] = ['Cash', 'Card', 'UPI', 'Bank Transfer'];

const channelLabel = (ch: SalesChannel) => ch.replace('Store', '').replace('Marketplace', 'Marketplace');

const toLocalDatetime = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const currency = formatCurrency;

interface SaleItemForm {
  product_id: string;
  product_name: string;
  sku: string;
  category: string;
  available_stock: number;
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
  total: number;
}

interface SaleFormValues {
  customer_id: string;
  customer_name: string;
  sale_date: string;
  sales_channel: SalesChannel;
  payment_method: PaymentMethod;
  notes: string;
  items: SaleItemForm[];
}

export const Sales: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'invoice_number' | 'total_amount' | 'sale_date'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SaleListItem | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [productOptions, setProductOptions] = useState<Product[]>([]);

  // Customer search state
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOptions, setCustomerOptions] = useState<CustomerType[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  const { data: sales = [], isLoading, isError } = useQuery({
    queryKey: ['sales', { search, customerFilter, channelFilter, paymentFilter, paymentStatusFilter, dateFrom, dateTo, sortBy, sortDir }],
    queryFn: () =>
      getSales({
        search: search || undefined,
        customer_name: customerFilter || undefined,
        sales_channel: channelFilter || undefined,
        payment_method: paymentFilter || undefined,
        payment_status: paymentStatusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      }),
  });

  const { data: summary } = useQuery({
    queryKey: ['sales', 'summary'],
    queryFn: () => import('../../api/saleApi').then(m => m.getSalesSummary()),
  });

  const summaryCards = summary
    ? [
        {
          title: 'Total Sales',
          value: summary.total_sales.toLocaleString(),
          iconBg: 'bg-indigo-500',
          cardBg: 'bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-900',
          border: 'border-indigo-100 dark:border-indigo-900/30',
          accent: 'bg-indigo-500',
          valueColor: 'text-indigo-700 dark:text-indigo-300',
          descColor: 'text-indigo-500 dark:text-indigo-400',
        },
        {
          title: 'Total Revenue',
          value: currency(summary.total_revenue),
          iconBg: 'bg-emerald-500',
          cardBg: 'bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900',
          border: 'border-emerald-100 dark:border-emerald-900/30',
          accent: 'bg-emerald-500',
          valueColor: 'text-emerald-700 dark:text-emerald-300',
          descColor: 'text-emerald-500 dark:text-emerald-400',
        },
        {
          title: 'Total Orders',
          value: summary.total_orders.toLocaleString(),
          iconBg: 'bg-amber-500',
          cardBg: 'bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900',
          border: 'border-amber-100 dark:border-amber-900/30',
          accent: 'bg-amber-500',
          valueColor: 'text-amber-700 dark:text-amber-300',
          descColor: 'text-amber-500 dark:text-amber-400',
        },
        {
          title: 'Avg Order Value',
          value: currency(summary.average_order_value),
          iconBg: 'bg-sky-500',
          cardBg: 'bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/20 dark:to-slate-900',
          border: 'border-sky-100 dark:border-sky-900/30',
          accent: 'bg-sky-500',
          valueColor: 'text-sky-700 dark:text-sky-300',
          descColor: 'text-sky-500 dark:text-sky-400',
        },
      ]
    : [];

  const defaultValues = {
    customer_id: '',
    customer_name: '',
    sale_date: toLocalDatetime(new Date()),
    sales_channel: 'Retail Store' as SalesChannel,
    payment_method: 'Cash' as PaymentMethod,
    notes: '',
    items: [] as SaleItemForm[],
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SaleFormValues>({
    defaultValues,
  });

  const watchedItems = watch('items') || [];

  const fetchProducts = async (q: string) => {
    try {
      const { getActiveProducts } = await import('../../api/productApi');
      const data = await getActiveProducts({ search: q || undefined });
      setProductOptions(data);
    } catch {
      setProductOptions([]);
    }
  };

  const openCreate = async () => {
    setEditing(null);
    setModalError(null);
    setSelectedProduct('');
    setProductOptions([]);
    setCustomerSearch('');
    setCustomerOptions([]);
    setShowCustomerDropdown(false);
    setSelectedCustomerId('');
    reset({
      customer_id: '',
      customer_name: '',
      sale_date: new Date().toISOString().slice(0, 16),
      sales_channel: 'Retail Store',
      payment_method: 'Cash',
      notes: '',
      items: [],
    });
    setModalOpen(true);
  };

  const openEdit = async (sale: SaleListItem) => {
    setEditing(sale);
    setModalError(null);
    setSelectedProduct('');
    setProductOptions([]);
    setCustomerSearch(sale.customer_name || '');
    setCustomerOptions([]);
    setShowCustomerDropdown(false);
    setSelectedCustomerId('');
    const full = await getSale(sale.id);
    const items = full.items.map((it) => ({
      product_id: it.product_id || '',
      product_name: it.product?.name || '',
      sku: it.product?.sku || '',
      category: it.product?.category?.name || it.category?.name || '',
      available_stock: it.product?.stock_quantity || 0,
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount: it.discount,
      tax: it.tax,
      total: it.total,
    }));
    setValue('customer_id', (full as any).customer_id || '');
    setSelectedCustomerId((full as any).customer_id || '');
    setValue('customer_name', full.customer_name || '');
    setValue('sale_date', toLocalDatetime(new Date(full.sale_date)));
    setValue('sales_channel', full.sales_channel);
    setValue('payment_method', full.payment_method);
    setValue('notes', (full as any).notes || '');
    setValue('items', items);
    setModalOpen(true);
  };

  const fetchCustomers = async (q: string) => {
    try {
      const data = await getCustomers({ search: q || undefined, limit: 20 });
      setCustomerOptions(data);
    } catch {
      setCustomerOptions([]);
    }
  };

  const onCustomerSelect = (customer: CustomerType) => {
    setSelectedCustomerId(customer.id);
    setCustomerSearch(`${customer.first_name} ${customer.last_name}`.trim());
    setValue('customer_name', `${customer.first_name} ${customer.last_name}`.trim());
    setShowCustomerDropdown(false);
    setCustomerOptions([]);
  };

  const addItem = () => {
    const items = watch('items') || [];
    setValue('items', [...items, {
      product_id: '',
      product_name: '',
      sku: '',
      category: '',
      available_stock: 0,
      quantity: 1,
      unit_price: 0,
      discount: 0,
      tax: 0,
      total: 0,
    }]);
    setSelectedProduct('');
    setProductOptions([]);
  };

  const removeItem = (index: number) => {
    const items = watch('items') || [];
    setValue('items', items.filter((_, i) => i !== index));
  };

  const updateItemField = (index: number, field: keyof SaleItemForm, value: any) => {
    const items = watch('items') || [];
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price' || field === 'discount' || field === 'tax') {
      const item = updated[index];
      const qty = Number(item.quantity);
      const price = Number(item.unit_price);
      const disc = Number(item.discount);
      const tax = Number(item.tax);
      const lineTotal = (qty * price) - disc + tax;
      item.total = lineTotal;
      if (field === 'quantity' && item.product_id) {
        const prod = productOptions.find((p) => p.id === item.product_id);
        if (prod && qty > prod.stock_quantity) {
          setModalError(`Quantity (${qty}) exceeds available stock (${prod.stock_quantity}) for ${prod.name}`);
        } else if (modalError?.includes('exceeds available stock')) {
          setModalError(null);
        }
      }
    }
    setValue('items', updated);
  };

  const onProductSelect = async (index: number, productId: string) => {
    const prod = productOptions.find((p) => p.id === productId);
    if (prod) {
      updateItemField(index, 'product_id', prod.id);
      updateItemField(index, 'product_name', prod.name);
      updateItemField(index, 'sku', prod.sku);
      updateItemField(index, 'category', prod.category?.name || '');
      updateItemField(index, 'available_stock', prod.stock_quantity);
      updateItemField(index, 'unit_price', prod.unit_price);
      const availableStock = prod.stock_quantity;
      const qty = availableStock > 0 ? 1 : 0;
      updateItemField(index, 'quantity', qty);
      updateItemField(index, 'discount', 0);
      updateItemField(index, 'tax', 0);
      updateItemField(index, 'total', prod.unit_price * qty);
      if (availableStock === 0) {
        setModalError(`Product "${prod.name}" is out of stock.`);
      }
    }
    setSelectedProduct('');
    setProductOptions([]);
  };

  const mutation = useMutation({
    mutationFn: (values: SaleFormValues) => {
      const items = values.items.map((it) => ({
        product_id: it.product_id || undefined,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        discount: Number(it.discount),
        tax: Number(it.tax),
      }));
      const payload: SaleCreate = {
        customer_id: selectedCustomerId || undefined,
        customer_name: customerSearch || values.customer_name || undefined,
        sale_date: values.sale_date,
        sales_channel: values.sales_channel,
        payment_method: values.payment_method,
        notes: values.notes || undefined,
        items,
      };
      return editing ? updateSale(editing.id, { ...payload, status: 'COMPLETED' } as SaleUpdate) : createSale(payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['customer-analytics-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['customer-analytics-summary'] });
      queryClient.invalidateQueries({ queryKey: ['top-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'segmentation'] });
      let message = editing ? 'Sale updated successfully.' : 'Sale created successfully.';
      if (data && data.items && data.items.length > 0) {
        const stockInfo = data.items
          .filter(item => item.product)
          .map(item => `${item.product?.name} (${item.product?.stock_quantity})`)
          .join(', ');
        if (stockInfo) {
          message += ` Remaining stock: ${stockInfo}`;
        }
      }
      showNotification(message, 'success');
      setModalError(null);
      setModalOpen(false);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to save sale. Please check your inputs.';
      setModalError(msg);
      showNotification(msg, 'error');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteSale(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['customer-analytics-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['customer-analytics-summary'] });
      queryClient.invalidateQueries({ queryKey: ['top-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'segmentation'] });
      showNotification('Sale deleted successfully', 'success');
    },
    onError: (err: any) => {
      showNotification(err?.response?.data?.error || 'Failed to delete sale', 'error');
    },
  });

  const onSubmit = (values: SaleFormValues) => {
    if (!values.items || values.items.length === 0) {
      setModalError('At least one item is required');
      return;
    }
    for (const item of values.items) {
      if (!item.product_id) {
        setModalError('All items must have a product selected');
        return;
      }
      if (item.quantity <= 0) {
        setModalError('Quantity must be greater than zero');
        return;
      }
      if (item.unit_price < 0) {
        setModalError('Unit price cannot be negative');
        return;
      }
      if (item.discount < 0) {
        setModalError('Discount cannot be negative');
        return;
      }
      if (item.tax < 0) {
        setModalError('Tax cannot be negative');
        return;
      }
      const subtotal = item.quantity * item.unit_price;
      if (item.discount > subtotal) {
        setModalError('Discount cannot exceed total product value');
        return;
      }
      const prod = productOptions.find((p) => p.id === item.product_id);
      if (prod && item.quantity > prod.stock_quantity) {
        setModalError(`Insufficient stock for ${prod.name}. Available: ${prod.stock_quantity}, Requested: ${item.quantity}`);
        return;
      }
    }
    setModalError(null);
    mutation.mutate(values);
  };

  const confirmDelete = (sale: SaleListItem) => {
    if (window.confirm(`Delete sale ${sale.invoice_number}? This cannot be undone.`)) {
      removeMutation.mutate(sale.id);
    }
  };

  const handleExportCSV = async () => {
    try {
      const result = await exportSalesCSV();
      const blob = new Blob([result.content], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || 'sales.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showNotification('Sales exported as CSV successfully.', 'success');
    } catch {
      showNotification('Failed to export sales as CSV.', 'error');
    }
  };

  const handleExportPDF = async () => {
    try {
      const result = await exportSalesPDF();
      const rows = result.content || [];
      if (!Array.isArray(rows) || rows.length === 0) {
        showNotification('No data to export', 'error');
        return;
      }
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Sales Report', 14, 15);
      const headers = Object.keys(rows[0]);
      const body = rows.map((row: any) => headers.map(key => String(row[key] !== null && row[key] !== undefined ? row[key] : '')));
      autoTable(doc, {
        head: [headers],
        body: body,
        startY: 20,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [220, 38, 38] }
      });
      doc.save(result.filename || 'sales.pdf');
      showNotification('Sales exported as PDF', 'success');
    } catch {
      showNotification('Failed to export sales as PDF', 'error');
    }
  };

  const inputClass =
    'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition-all';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Sales</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Manage your sales transactions and invoices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-white text-xs font-bold tracking-wide shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
            title="Export as CSV"
          >
            <CsvIcon style={{ fontSize: 16 }} />
            CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-white text-xs font-bold tracking-wide shadow-lg shadow-rose-500/20 transition-all hover:shadow-rose-500/30 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)' }}
            title="Export as PDF"
          >
            <PdfIcon style={{ fontSize: 16 }} />
            PDF
          </button>
          {isAdmin && (
            <button
              onClick={openCreate}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold tracking-wide shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}
            >
              <AddIcon style={{ fontSize: 17 }} />
              New Sale
            </button>
          )}
        </div>
      </div>

      {summaryCards.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
          {summaryCards.map((item, idx) => (
            <div
              key={idx}
              className={`relative overflow-hidden rounded-2xl p-4 md:p-5 border shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group ${item.cardBg} ${item.border}`}
            >
              <div className={`absolute top-0 left-0 right-0 h-0.5 ${item.accent}`}/>
              <div className="flex items-start justify-between mb-3">
                <span className="text-[10px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-tight">{item.title}</span>
              </div>
              <div className={`text-2xl md:text-3xl font-extrabold tracking-tight mb-1 ${item.valueColor}`}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center gap-3 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 18 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice, customer or product..."
              className={`w-full ${inputClass} pl-10`}
            />
          </div>
          <input
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            placeholder="Customer name..."
            className={`${inputClass} lg:w-44`}
          />
          <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className={`${inputClass} lg:w-40`}>
            <option value="">All Channels</option>
            {CHANNEL_OPTIONS.map((c) => (
              <option key={c} value={c}>{channelLabel(c)}</option>
            ))}
          </select>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className={`${inputClass} lg:w-40`}>
            <option value="">All Payments</option>
            {PAYMENT_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)} className={`${inputClass} lg:w-40`}>
            <option value="">All Payment Status</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="PARTIAL">Partial</option>
          </select>
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
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="invoice_number-asc">Invoice (A-Z)</option>
            <option value="invoice_number-desc">Invoice (Z-A)</option>
            <option value="total_amount-desc">Amount (High-Low)</option>
            <option value="total_amount-asc">Amount (Low-High)</option>
            <option value="sale_date-desc">Date (Newest)</option>
            <option value="sale_date-asc">Date (Oldest)</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          </div>
        ) : isError ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-red-600 font-medium">Failed to load sales.</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-6">
            <CartIcon className="text-slate-300 dark:text-slate-700" style={{ fontSize: 48 }} />
            <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-400">No sales found</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Create a new sale to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-3 font-bold">Invoice Number</th>
                  <th className="px-6 py-3 font-bold">Customer Name</th>
                  <th className="px-6 py-3 font-bold">Sale Date</th>
                  <th className="px-6 py-3 font-bold">Number of Items</th>
                  <th className="px-6 py-3 font-bold">Total Amount</th>
                  <th className="px-6 py-3 font-bold">Payment Status</th>
                  {isAdmin && <th className="px-6 py-3 font-bold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="group border-b border-slate-100 dark:border-slate-800/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10 transition-colors">
                    <td className="px-6 py-3.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-100">{sale.invoice_number}</td>
                    <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">{sale.customer_name || '—'}</td>
                    <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">{new Date(sale.sale_date).toLocaleDateString()}</td>
                    <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">{sale.item_count || 0}</td>
                    <td className="px-6 py-3.5 font-semibold text-slate-800 dark:text-slate-100">{currency(sale.total_amount)}</td>
                    <td className="px-6 py-3.5">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold capitalize tracking-wide ${
                        sale.payment_status === 'PAID' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' :
                        sale.payment_status === 'PENDING' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30' :
                        sale.payment_status === 'PARTIAL' ? 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-900/30' :
                        'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30'
                      }`}>
                        {sale.payment_status.toLowerCase()}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/sales/${sale.id}`)}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
                            title="View"
                          >
                            <ViewIcon style={{ fontSize: 16 }} />
                          </button>
                          <button
                            onClick={() => openEdit(sale)}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
                            title="Edit"
                          >
                            <EditIcon style={{ fontSize: 16 }} />
                          </button>
                          <button
                            onClick={() => confirmDelete(sale)}
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
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-modal-enter">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {editing ? 'Edit Sale' : 'New Sale'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <CloseIcon style={{ fontSize: 20 }} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              {modalError && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400 text-sm font-medium">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>{modalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Customer</label>
                  <div className="relative">
                    <input
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setSelectedCustomerId('');
                        setShowCustomerDropdown(true);
                        fetchCustomers(e.target.value);
                      }}
                      onFocus={() => {
                        setShowCustomerDropdown(true);
                        fetchCustomers(customerSearch);
                      }}
                      onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                      placeholder="Search or type customer name..."
                      className={inputClass}
                    />
                    {selectedCustomerId && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-full pointer-events-none">Linked</span>
                    )}
                    {showCustomerDropdown && customerOptions.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                        {customerOptions.map((c) => (
                          <div
                            key={c.id}
                            onMouseDown={() => onCustomerSelect(c)}
                            className="px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer text-slate-700 dark:text-slate-300 flex items-center justify-between"
                          >
                            <span className="font-medium">{c.first_name} {c.last_name}</span>
                            {c.email && <span className="text-slate-400 text-[10px] truncate max-w-[120px]">{c.email}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Sale Date & Time *</label>
                  <input type="datetime-local" {...register('sale_date', { required: true })} className={inputClass} />
                  {errors.sale_date && <p className="text-red-500 text-[10px] mt-1 font-semibold">Required</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Sales Channel *</label>
                  <select {...register('sales_channel', { required: true })} className={inputClass}>
                    {CHANNEL_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Payment Method *</label>
                  <select {...register('payment_method', { required: true })} className={inputClass}>
                    {PAYMENT_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Items *</label>
                  <button type="button" onClick={addItem} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
                    + Add Item
                  </button>
                </div>
                {watchedItems.length === 0 && (
                  <p className="text-xs text-slate-400 mb-2">No items added yet. Click "Add Item" to add products.</p>
                )}
                 <div className="space-y-3">
                   {watchedItems.map((item, idx) => (
                     <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-950/30">
                       <div className="col-span-12 md:col-span-2">
                         <label className="block text-[10px] font-semibold text-slate-500 mb-1">Product *</label>
                         <input
                           value={item.product_name}
                           onChange={(e) => updateItemField(idx, 'product_name', e.target.value)}
                           onFocus={async () => {
                             setSelectedProduct(item.product_id);
                             await fetchProducts(item.product_name);
                           }}
                           placeholder="Search product..."
                           className={`${inputClass} text-[11px]`}
                         />
                         {productOptions.length > 0 && selectedProduct === item.product_id && (
                           <div className="relative">
                             <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                               {productOptions.map((p) => (
                                 <div
                                   key={p.id}
                                   className="px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer text-slate-700 dark:text-slate-300"
                                   onClick={() => onProductSelect(idx, p.id)}
                                 >
                                   {p.name} ({p.sku}) - Stock: {p.stock_quantity}
                                 </div>
                               ))}
                             </div>
                           </div>
                         )}
                       </div>
                       <div className="col-span-6 md:col-span-1">
                         <label className="block text-[10px] font-semibold text-slate-500 mb-1">SKU</label>
                         <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 pt-2 truncate" title={item.sku}>{item.sku || '—'}</div>
                       </div>
                       <div className="col-span-6 md:col-span-1">
                         <label className="block text-[10px] font-semibold text-slate-500 mb-1">Category</label>
                         <div className="text-[11px] text-slate-600 dark:text-slate-300 pt-2 truncate" title={item.category}>{item.category || '—'}</div>
                       </div>
                       <div className="col-span-4 md:col-span-1">
                         <label className="block text-[10px] font-semibold text-slate-500 mb-1">Available</label>
                         <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 pt-2">{item.available_stock}</div>
                       </div>
                       <div className="col-span-4 md:col-span-1">
                         <label className="block text-[10px] font-semibold text-slate-500 mb-1">Qty *</label>
                         <input type="number" min="1" value={item.quantity} onChange={(e) => updateItemField(idx, 'quantity', Number(e.target.value))} className={`${inputClass} text-[11px] w-full`} />
                       </div>
                       <div className="col-span-4 md:col-span-1">
                         <label className="block text-[10px] font-semibold text-slate-500 mb-1">Unit Price</label>
                         <input type="number" step="0.01" min="0" value={item.unit_price} onChange={(e) => updateItemField(idx, 'unit_price', Number(e.target.value))} className={`${inputClass} text-[11px] w-full`} />
                       </div>
                       <div className="col-span-6 md:col-span-1">
                         <label className="block text-[10px] font-semibold text-slate-500 mb-1">Disc</label>
                         <input type="number" step="0.01" min="0" value={item.discount} onChange={(e) => updateItemField(idx, 'discount', Number(e.target.value))} className={`${inputClass} text-[11px] w-full`} />
                       </div>
                       <div className="col-span-6 md:col-span-1">
                         <label className="block text-[10px] font-semibold text-slate-500 mb-1">Tax</label>
                         <input type="number" step="0.01" min="0" value={item.tax} onChange={(e) => updateItemField(idx, 'tax', Number(e.target.value))} className={`${inputClass} text-[11px] w-full`} />
                       </div>
                       <div className="col-span-12 md:col-span-2">
                         <label className="block text-[10px] font-semibold text-slate-500 mb-1">Total</label>
                         <div className="text-xs font-bold text-slate-700 dark:text-slate-200 pt-2 px-1 truncate" title={currency(item.total)}>{currency(item.total)}</div>
                       </div>
                       <div className="col-span-12 md:col-span-1 flex justify-end">
                         <button type="button" onClick={() => removeItem(idx)} className="p-1.5 rounded text-red-500 hover:text-red-700 mb-1">
                           <CloseIcon style={{ fontSize: 16 }} />
                         </button>
                       </div>
                     </div>
                   ))}
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Billing Summary</h3>
                  {(() => {
                    const subtotal = watchedItems.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.unit_price)), 0);
                    const totalDiscount = watchedItems.reduce((sum, it) => sum + Number(it.discount), 0);
                    const totalTax = watchedItems.reduce((sum, it) => sum + Number(it.tax), 0);
                    const grandTotal = subtotal - totalDiscount + totalTax;
                    return (
                      <>
                        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                          <span>Subtotal</span>
                          <span className="font-mono">{currency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                          <span>Discount</span>
                          <span className="font-mono text-red-600">-{currency(totalDiscount)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                          <span>Tax</span>
                          <span className="font-mono">{currency(totalTax)}</span>
                        </div>
                        <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex justify-between text-sm font-extrabold text-slate-900 dark:text-white">
                          <span>Grand Total</span>
                          <span className="font-mono">{currency(grandTotal)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Notes</h3>
                  <textarea
                    placeholder="Add any notes about this sale..."
                    className={`${inputClass} w-full h-full min-h-[80px] resize-none text-xs`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/10 transition-all disabled:opacity-60"
                >
                  {mutation.isPending ? 'SAVING...' : editing ? 'UPDATE' : 'CREATE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Sales;
