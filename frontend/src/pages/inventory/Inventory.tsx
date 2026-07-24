import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  getInventoryItems,
  getInventorySummary,
  getCategoryBreakdown,
  getStatusBreakdown,
  getStockMovements,
  getAdjustments,
  addStock,
  removeStock,
  adjustStock,
  updateReorderLevel,
} from '../../api/inventoryApi';
import { getCategories } from '../../api/categoryApi';
import { getProducts } from '../../api/productApi';
import type { Category } from '../../api/categoryApi';
import type { StockMovement, InventoryAdjustment } from '../../api/inventoryApi';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  TrendingUp as TrendingIcon,
  Category as CategoryIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  RemoveShoppingCart as OutOfStockIcon,
  ShowChart as ChartIcon,
  History as HistoryIcon,
  Tune as TuneIcon,
  AddCircle as AddCircleIcon,
  Remove as RemoveIcon,
  SwapHoriz as SwapIcon,
  ArrowUpward as ArrowUpIcon,
} from '@mui/icons-material';

interface StockFormValues {
  product_id: string;
  quantity: number;
  reason: string;
  remarks: string;
}

const STATUS_STYLES: Record<string, string> = {
  IN_STOCK: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30',
  LOW_STOCK: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30',
  OUT_OF_STOCK: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30',
};

const MOVEMENT_TYPE_STYLES: Record<string, string> = {
  SALE: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400',
  MANUAL_ADJUSTMENT: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
  STOCK_ADDITION: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400',
  STOCK_REMOVAL: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400',
};

const ADJ_TYPE_STYLES: Record<string, string> = {
  STOCK_IN: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400',
  STOCK_OUT: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400',
  MANUAL_ADJUSTMENT: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
};

export const Inventory: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [activeTab, setActiveTab] = useState<'inventory' | 'movements' | 'adjustments'>('inventory');
  const [movementTypeFilter, setMovementTypeFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'remove' | 'adjust'>('add');
  const [modalError, setModalError] = useState<string | null>(null);
  const [editingReorderId, setEditingReorderId] = useState<string | null>(null);
  const [editingReorderValue, setEditingReorderValue] = useState<number>(0);

  const { data: summary } = useQuery({
    queryKey: ['inventory', 'summary'],
    queryFn: getInventorySummary,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories', ''],
    queryFn: () => getCategories(),
  });

  const { data: catBreakdown = [] } = useQuery({
    queryKey: ['inventory', 'category-breakdown'],
    queryFn: getCategoryBreakdown,
  });

  const { data: statusBreakdown = [] } = useQuery({
    queryKey: ['inventory', 'status-breakdown'],
    queryFn: getStatusBreakdown,
  });

  const { data: inventoryItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['inventory', 'items', { search, categoryFilter, statusFilter, brandFilter, sortBy, sortDir }],
    queryFn: () =>
      getInventoryItems({
        search: search || undefined,
        category_id: categoryFilter || undefined,
        stock_status: statusFilter || undefined,
        brand: brandFilter || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      }),
  });

  const { data: movements = [], isLoading: movementsLoading } = useQuery({
    queryKey: ['inventory', 'movements', { movementTypeFilter }],
    queryFn: () =>
      getStockMovements({
        movement_type: movementTypeFilter || undefined,
      }),
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => getProducts({ status: 'ACTIVE' }),
  });

  const { data: adjustments = [], isLoading: adjustmentsLoading } = useQuery<InventoryAdjustment[]>({
    queryKey: ['inventory', 'adjustments'],
    queryFn: () => getAdjustments(),
    enabled: isAdmin,
  });

  const stockMutation = useMutation({
    mutationFn: async (values: StockFormValues) => {
      const payload = {
        product_id: values.product_id,
        quantity: Number(values.quantity),
        reason: values.reason || undefined,
        remarks: values.remarks || undefined,
      };
      if (modalMode === 'add') return addStock(payload);
      if (modalMode === 'remove') return removeStock(payload);
      return adjustStock(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      showNotification('Stock updated successfully', 'success');
      setModalOpen(false);
      setModalError(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Failed to update stock.';
      setModalError(msg);
      showNotification(msg, 'error');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: ({ productId, threshold }: { productId: string; threshold: number }) =>
      updateReorderLevel(productId, threshold),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      showNotification('Reorder level updated', 'success');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Failed to update reorder level.';
      showNotification(msg, 'error');
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StockFormValues>({
    defaultValues: { product_id: '', quantity: 0, reason: '', remarks: '' },
  });

  const openStockModal = (mode: 'add' | 'remove' | 'adjust') => {
    setModalMode(mode);
    setModalError(null);
    reset({ product_id: '', quantity: 0, reason: '', remarks: '' });
    setModalOpen(true);
  };

  const onSubmit = (values: StockFormValues) => {
    if (values.quantity === 0) {
      setModalError('Quantity must not be zero.');
      return;
    }
    if (modalMode !== 'adjust' && values.quantity < 0) {
      setModalError('Quantity must be positive for add/remove.');
      return;
    }
    setModalError(null);
    stockMutation.mutate(values);
  };

  const startEditReorder = (item: { id: string; low_stock_threshold: number }) => {
    setEditingReorderId(item.id);
    setEditingReorderValue(item.low_stock_threshold);
  };

  const saveReorder = (itemId: string) => {
    if (editingReorderValue < 0) {
      showNotification('Reorder level cannot be negative', 'error');
      setEditingReorderId(null);
      return;
    }
    reorderMutation.mutate({ productId: itemId, threshold: editingReorderValue });
    setEditingReorderId(null);
  };

  const chartWidth = 400;
  const chartHeight = 180;
  const padding = { top: 20, right: 25, bottom: 30, left: 90 };
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  const catBars = useMemo(() => {
    const labels = catBreakdown.map((c) => c.category_name);
    const values = catBreakdown.map((c) => c.product_count);
    const max = Math.max(...values, 1);
    const barHeight = Math.max(8, Math.min(24, innerH / Math.max(labels.length, 1) - 6));
    const totalHeight = labels.length * (barHeight + 6);
    const startY = padding.top + (innerH - totalHeight) / 2;
    return labels.map((label, i) => {
      const width = (values[i] / max) * innerW;
      const y = startY + i * (barHeight + 6);
      return { label, value: values[i], width, y, barHeight };
    });
  }, [catBreakdown, innerW, innerH, padding.top]);

  const statusBars = useMemo(() => {
    const labels = statusBreakdown.map((s) => s.stock_status);
    const values = statusBreakdown.map((s) => s.product_count);
    const max = Math.max(...values, 1);
    const barHeight = 20;
    const totalHeight = labels.length * (barHeight + 6);
    const startY = padding.top + (innerH - totalHeight) / 2;
    const colors: Record<string, string> = {
      IN_STOCK: '#10b981',
      LOW_STOCK: '#f59e0b',
      OUT_OF_STOCK: '#ef4444',
    };
    return labels.map((label, i) => {
      const width = (values[i] / max) * innerW;
      const y = startY + i * (barHeight + 6);
      return { label, value: values[i], width, y, barHeight, color: colors[label] || '#6366f1' };
    });
  }, [statusBreakdown, innerW, innerH, padding.top]);

  const inputClass =
    'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition-all';

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Inventory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Monitor and manage product stock levels.
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => openStockModal('add')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold tracking-wide shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <AddCircleIcon style={{ fontSize: 17 }} />
              Add Stock
            </button>
            <button onClick={() => openStockModal('remove')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold tracking-wide shadow-lg shadow-red-500/20 transition-all hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
              <RemoveIcon style={{ fontSize: 17 }} />
              Remove Stock
            </button>
            <button onClick={() => openStockModal('adjust')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold tracking-wide shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
              <SwapIcon style={{ fontSize: 17 }} />
              Adjust Stock
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        {[
          { title: 'Total Products', value: (summary?.total_products ?? 0).toLocaleString(), icon: <InventoryIcon className="text-white" />, iconBg: 'bg-indigo-500', cardBg: 'bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-900', border: 'border-indigo-100 dark:border-indigo-900/30', accent: 'bg-indigo-500', valueColor: 'text-indigo-700 dark:text-indigo-300', descColor: 'text-indigo-500 dark:text-indigo-400' },
          { title: 'Total Inventory Qty', value: (summary?.total_inventory_quantity ?? 0).toLocaleString(), icon: <ChartIcon className="text-white" />, iconBg: 'bg-sky-500', cardBg: 'bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/20 dark:to-slate-900', border: 'border-sky-100 dark:border-sky-900/30', accent: 'bg-sky-500', valueColor: 'text-sky-700 dark:text-sky-300', descColor: 'text-sky-500 dark:text-sky-400' },
          { title: 'Low Stock Products', value: (summary?.low_stock_products ?? 0).toLocaleString(), icon: <WarningIcon className="text-white" />, iconBg: 'bg-amber-500', cardBg: 'bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900', border: 'border-amber-100 dark:border-amber-900/30', accent: 'bg-amber-500', valueColor: 'text-amber-700 dark:text-amber-300', descColor: 'text-amber-500 dark:text-amber-400' },
          { title: 'Out of Stock', value: (summary?.out_of_stock_products ?? 0).toLocaleString(), icon: <OutOfStockIcon className="text-white" />, iconBg: 'bg-red-500', cardBg: 'bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-slate-900', border: 'border-red-100 dark:border-red-900/30', accent: 'bg-red-500', valueColor: 'text-red-700 dark:text-red-300', descColor: 'text-red-500 dark:text-red-400' },
        ].map((item, idx) => (
          <div key={idx} className={`relative overflow-hidden rounded-2xl p-4 md:p-5 border shadow-sm hover:shadow-lg transition-all duration-200 ${item.cardBg} ${item.border}`}>
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${item.accent}`}/>
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-tight">{item.title}</span>
              <div className={`h-8 w-8 md:h-9 md:w-9 rounded-xl flex items-center justify-center shadow-md shrink-0 ${item.iconBg}`}>
                {item.icon}
              </div>
            </div>
            <div className={`text-2xl md:text-3xl font-extrabold tracking-tight mb-1 ${item.valueColor}`}>{item.value}</div>
            <div className={`text-[10px] md:text-xs font-semibold flex items-center gap-1 ${item.descColor}`}>
              <ArrowUpIcon style={{ fontSize: 11 }} />
              Current count
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
            <CategoryIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Inventory by Category</h2>
          </div>
          <div className="p-4">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
              {catBars.map((bar, i) => (
                <g key={i}>
                  <text x={padding.left - 8} y={bar.y + bar.barHeight / 2 + 3} className="text-[9px] font-bold fill-slate-500 dark:fill-slate-400" textAnchor="end">
                    {bar.label.length > 15 ? bar.label.slice(0, 15) + '…' : bar.label}
                  </text>
                  <rect x={padding.left} y={bar.y} width={bar.width} height={bar.barHeight} rx={4} fill="#6366f1" opacity={0.85} />
                  <text x={padding.left + bar.width + 6} y={bar.y + bar.barHeight / 2 + 3} className="text-[10px] font-bold fill-slate-600 dark:fill-slate-300" textAnchor="start">
                    {bar.value}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
            <TrendingIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Stock Status Distribution</h2>
          </div>
          <div className="p-4">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
              {statusBars.map((bar, i) => (
                <g key={i}>
                  <text x={padding.left - 8} y={bar.y + bar.barHeight / 2 + 3} className="text-[9px] font-bold fill-slate-500 dark:fill-slate-400" textAnchor="end">
                    {bar.label.replace(/_/g, ' ')}
                  </text>
                  <rect x={padding.left} y={bar.y} width={bar.width} height={bar.barHeight} rx={4} fill={bar.color} opacity={0.85} />
                  <text x={padding.left + bar.width + 6} y={bar.y + bar.barHeight / 2 + 3} className="text-[10px] font-bold fill-slate-600 dark:fill-slate-300" textAnchor="start">
                    {bar.value}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center gap-3 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 18 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU..."
              className={`w-full ${inputClass} pl-10`}
            />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${inputClass} lg:w-44`}>
            <option value="">All Categories</option>
            {categories.map((c: Category) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} lg:w-40`}>
            <option value="">All Status</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className={`${inputClass} lg:w-40`}>
            <option value="">All Brands</option>
            {Array.from(new Set(inventoryItems.map((p) => p.brand).filter(Boolean))).map((b) => (
              <option key={b as string} value={b as string}>{b as string}</option>
            ))}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`${inputClass} lg:w-44`}>
            <option value="name">Sort: Product Name</option>
            <option value="current_stock">Sort: Current Stock</option>
            <option value="recently_updated">Sort: Recently Updated</option>
          </select>
          <select value={sortDir} onChange={(e) => setSortDir(e.target.value)} className={`${inputClass} lg:w-28`}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          {([
            { key: 'inventory' as const, label: 'Inventory' },
            { key: 'movements' as const, label: 'Stock Movements' },
            ...(isAdmin ? [{ key: 'adjustments' as const, label: 'Adjustment History' }] : []),
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-xs font-bold tracking-wide transition-all ${
                activeTab === tab.key
                  ? 'text-indigo-700 dark:text-indigo-400 border-b-2 border-indigo-500 bg-white dark:bg-slate-900'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'inventory' && (
          <>
            {itemsLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
              </div>
            ) : inventoryItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                <InventoryIcon className="text-slate-300 dark:text-slate-700" style={{ fontSize: 48 }} />
                <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-400">No inventory items found</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try adjusting your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <th className="px-6 py-3 font-bold">Product</th>
                      <th className="px-6 py-3 font-bold">SKU</th>
                      <th className="px-6 py-3 font-bold">Category</th>
                      <th className="px-6 py-3 font-bold">Brand</th>
                      <th className="px-6 py-3 font-bold text-right">Current</th>
                      <th className="px-6 py-3 font-bold text-right">Reserved</th>
                      <th className="px-6 py-3 font-bold text-right">Available</th>
                      <th className="px-6 py-3 font-bold text-right">Reorder Level</th>
                      <th className="px-6 py-3 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryItems.map((item) => (
                      <tr key={item.id} className="group border-b border-slate-100 dark:border-slate-800/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="font-bold text-slate-800 dark:text-slate-100">{item.name}</div>
                          {item.description && (
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[220px]">{item.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{item.sku}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{item.category_name || '—'}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{item.brand || '—'}</td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-800 dark:text-slate-100">{item.stock_quantity}</td>
                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-300">{item.reserved_stock}</td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-800 dark:text-slate-100">{item.available_stock}</td>
                         <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-300">
                          {isAdmin && editingReorderId === item.id ? (
                            <input
                              type="number"
                              className="w-16 text-right border border-indigo-500 rounded px-1 py-0.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                              value={editingReorderValue}
                              onChange={(e) => setEditingReorderValue(Number(e.target.value))}
                              onBlur={() => saveReorder(item.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveReorder(item.id);
                                if (e.key === 'Escape') setEditingReorderId(null);
                              }}
                              autoFocus
                            />
                          ) : (
                            <span
                              className={`${isAdmin ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400' : ''}`}
                              onClick={() => isAdmin && startEditReorder(item)}
                              title={isAdmin ? 'Click to edit reorder level' : ''}
                            >
                              {item.low_stock_threshold}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold capitalize tracking-wide ${STATUS_STYLES[item.stock_status] || 'bg-slate-100 text-slate-600'}`}>
                            {item.stock_status.replace('_', ' ').toLowerCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === 'movements' && (
          <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 bg-slate-50/50 dark:bg-slate-900/30">
            <select value={movementTypeFilter} onChange={(e) => setMovementTypeFilter(e.target.value)} className={`${inputClass} lg:w-44`}>
              <option value="">All Movement Types</option>
              <option value="SALE">Sale</option>
              <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
              <option value="STOCK_ADDITION">Stock Addition</option>
              <option value="STOCK_REMOVAL">Stock Removal</option>
            </select>
          </div>
        )}
        {activeTab === 'movements' && (
          movementsLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
            </div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <HistoryIcon className="text-slate-300 dark:text-slate-700" style={{ fontSize: 48 }} />
              <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-400">No stock movements yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-6 py-3 font-bold">Product</th>
                    <th className="px-6 py-3 font-bold">Type</th>
                    <th className="px-6 py-3 font-bold text-right">Previous</th>
                    <th className="px-6 py-3 font-bold text-right">Updated</th>
                    <th className="px-6 py-3 font-bold text-right">Changed</th>
                    <th className="px-6 py-3 font-bold">Reason</th>
                    <th className="px-6 py-3 font-bold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m: StockMovement) => (
                    <tr key={m.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{m.product_name || '—'}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{m.product_sku || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${MOVEMENT_TYPE_STYLES[m.movement_type] || 'bg-slate-100 text-slate-600'}`}>
                          {m.movement_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-300">{m.previous_quantity}</td>
                      <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-300">{m.updated_quantity}</td>
                      <td className={`px-6 py-4 text-right font-bold ${m.quantity_changed > 0 ? 'text-emerald-600 dark:text-emerald-400' : m.quantity_changed < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                        {m.quantity_changed > 0 ? '+' : ''}{m.quantity_changed}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{m.reason || '—'}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{new Date(m.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'adjustments' && isAdmin && (
          adjustmentsLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
            </div>
          ) : adjustments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <TuneIcon className="text-slate-300 dark:text-slate-700" style={{ fontSize: 48 }} />
              <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-400">No adjustments yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <th className="px-6 py-3 font-bold">Product</th>
                    <th className="px-6 py-3 font-bold">Type</th>
                    <th className="px-6 py-3 font-bold text-right">Quantity</th>
                    <th className="px-6 py-3 font-bold">Reason</th>
                    <th className="px-6 py-3 font-bold">Remarks</th>
                    <th className="px-6 py-3 font-bold">Adjusted By</th>
                    <th className="px-6 py-3 font-bold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((a: InventoryAdjustment) => (
                    <tr key={a.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{a.product_name || '—'}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{a.product_sku || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ADJ_TYPE_STYLES[a.adjustment_type] || 'bg-slate-100 text-slate-600'}`}>
                          {a.adjustment_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-right font-bold ${Number(a.quantity) > 0 ? 'text-emerald-600 dark:text-emerald-400' : Number(a.quantity) < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                        {Number(a.quantity) > 0 ? '+' : ''}{a.quantity}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-[180px] truncate">{a.reason || '—'}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-[180px] truncate">{a.remarks || '—'}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 truncate">{a.adjusted_by || '—'}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{new Date(a.adjusted_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-modal-enter">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {modalMode === 'add' ? 'Add Stock' : modalMode === 'remove' ? 'Remove Stock' : 'Adjust Stock'}
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Product *</label>
                <select {...register('product_id', { required: 'Product is required' })} className={inputClass}>
                  <option value="">Select product</option>
                  {allProducts.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
                {errors.product_id && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.product_id.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Quantity {modalMode !== 'adjust' && <span className="text-slate-400">(positive)</span>}
                </label>
                <input type="number" {...register('quantity', { required: true, valueAsNumber: true })} className={inputClass} placeholder="Enter quantity" />
                {errors.quantity && <p className="text-red-500 text-[10px] mt-1 font-semibold">Quantity is required</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Reason</label>
                <input {...register('reason')} className={inputClass} placeholder="e.g. Purchase order #1234" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Remarks</label>
                <textarea {...register('remarks')} rows={2} className={`${inputClass} resize-none`} placeholder="Optional details" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                  CANCEL
                </button>
                <button type="submit" disabled={stockMutation.isPending} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/10 transition-all disabled:opacity-60">
                  {stockMutation.isPending ? 'PROCESSING...' : 'CONFIRM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
