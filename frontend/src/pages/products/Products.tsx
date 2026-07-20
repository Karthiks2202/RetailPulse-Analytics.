import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  activateProduct,
  deactivateProduct,
} from '../../api/productApi';
import type { Product, ProductCreate } from '../../api/productApi';
import { getCategories } from '../../api/categoryApi';
import type { Category } from '../../api/categoryApi';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Inventory as InventoryIcon,
  CheckCircle as CheckIcon,
  Block as BlockIcon,
} from '@mui/icons-material';

const UNIT_OPTIONS = ['PCS', 'KG', 'G', 'L', 'ML', 'BOX', 'PACK', 'M', 'CM'];

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

const currency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

interface ProductFormValues {
  name: string;
  sku: string;
  category_id: string;
  brand: string;
  description: string;
  unit_price: number;
  cost_price: number;
  stock_quantity: number;
  unit_of_measure: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export const Products: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'unit_price' | 'created_at'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', ''],
    queryFn: () => getCategories(),
  });

  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: ['products', { search, categoryFilter, statusFilter, brandFilter, sortBy, sortDir }],
    queryFn: () =>
      getProducts({
        search: search || undefined,
        category_id: categoryFilter || undefined,
        status: statusFilter || undefined,
        brand: brandFilter || undefined,
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
  } = useForm<ProductFormValues>({
    defaultValues: {
      name: '',
      sku: '',
      category_id: '',
      brand: '',
      description: '',
      unit_price: 0,
      cost_price: 0,
      stock_quantity: 0,
      unit_of_measure: 'PCS',
      status: 'ACTIVE',
    },
  });

  const openCreate = () => {
    setEditing(null);
    setModalError(null);
    reset({
      name: '',
      sku: '',
      category_id: '',
      brand: '',
      description: '',
      unit_price: 0,
      cost_price: 0,
      stock_quantity: 0,
      unit_of_measure: 'PCS',
      status: 'ACTIVE',
    });
    setModalOpen(true);
  };

  const openEdit = (prod: Product) => {
    setEditing(prod);
    setModalError(null);
    setValue('name', prod.name);
    setValue('sku', prod.sku);
    setValue('category_id', prod.category_id || '');
    setValue('brand', prod.brand || '');
    setValue('description', prod.description || '');
    setValue('unit_price', prod.unit_price);
    setValue('cost_price', prod.cost_price);
    setValue('stock_quantity', prod.stock_quantity);
    setValue('unit_of_measure', prod.unit_of_measure);
    setValue('status', prod.status);
    setModalOpen(true);
  };

  const mutation = useMutation({
    mutationFn: (values: ProductFormValues) => {
      const payload: ProductCreate = {
        name: values.name,
        sku: values.sku,
        category_id: values.category_id || undefined,
        brand: values.brand || undefined,
        description: values.description || undefined,
        unit_price: Number(values.unit_price),
        cost_price: Number(values.cost_price),
        stock_quantity: Number(values.stock_quantity),
        unit_of_measure: values.unit_of_measure,
        status: values.status,
      };
      return editing ? updateProduct(editing.id, payload) : createProduct(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showNotification(editing ? 'Product updated successfully' : 'Product created successfully', 'success');
      setModalError(null);
      setModalOpen(false);
    },
    onError: (err: any) => {
      // FastAPI returns { detail: '...' }, some custom routes use { error: '...' }
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to save product. Please check your inputs.';
      setModalError(msg);
      showNotification(msg, 'error');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showNotification('Product deleted successfully', 'success');
    },
    onError: (err: any) => {
      showNotification(err?.response?.data?.error || 'Failed to delete product', 'error');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (prod: Product) =>
      prod.status === 'ACTIVE' ? deactivateProduct(prod.id) : activateProduct(prod.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showNotification('Product status updated', 'success');
    },
    onError: (err: any) => {
      showNotification(err?.response?.data?.error || 'Failed to update status', 'error');
    },
  });

  const onSubmit = (values: ProductFormValues) => {
    // Client-side guard: cost price must not exceed unit price
    if (Number(values.cost_price) > Number(values.unit_price)) {
      setModalError('Cost price cannot exceed unit price. Please correct the values.');
      return;
    }
    setModalError(null);
    mutation.mutate(values);
  };

  const confirmDelete = (prod: Product) => {
    if (window.confirm(`Delete product "${prod.name}" (${prod.sku})? This cannot be undone.`)) {
      removeMutation.mutate(prod.id);
    }
  };

  const inputClass =
    'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition-all';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Products</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Manage your company's product master data.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold tracking-wide shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}
          >
            <AddIcon style={{ fontSize: 17 }} />
            + New Product
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center gap-3 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 18 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU or brand..."
              className={`w-full ${inputClass} pl-10`}
            />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${inputClass} lg:w-44`}>
            <option value="">All Categories</option>
            {categories.map((c: Category) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} lg:w-36`}>
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className={`${inputClass} lg:w-40`}>
            <option value="">All Brands</option>
            {Array.from(new Set(products.map((p) => p.brand).filter(Boolean))).map((b) => (
              <option key={b as string} value={b as string}>{b as string}</option>
            ))}
          </select>
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
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="unit_price-desc">Price (High-Low)</option>
            <option value="unit_price-asc">Price (Low-High)</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          </div>
        ) : isError ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-red-600 font-medium">Failed to load products.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-6">
            <InventoryIcon className="text-slate-300 dark:text-slate-700" style={{ fontSize: 48 }} />
            <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-400">No products found</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Add a product to start building your catalog.</p>
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
                  <th className="px-6 py-3 font-bold">Unit Price</th>
                  <th className="px-6 py-3 font-bold">Stock</th>
                  <th className="px-6 py-3 font-bold">Status</th>
                  {isAdmin && <th className="px-6 py-3 font-bold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {products.map((prod) => (
                  <tr key={prod.id} className="group border-b border-slate-100 dark:border-slate-800/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-bold text-slate-800 dark:text-slate-100">{prod.name}</div>
                      {prod.description && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[220px]">{prod.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{prod.sku}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{prod.category?.name || '—'}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{prod.brand || '—'}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-100">{currency(prod.unit_price)}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{prod.stock_quantity} {prod.unit_of_measure}</td>
                    <td className="px-6 py-4"><StatusBadge status={prod.status} /></td>
                    {isAdmin && (
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleMutation.mutate(prod)}
                            className={`p-2 rounded-lg border transition-all ${
                              prod.status === 'ACTIVE'
                                ? 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 hover:border-amber-300 dark:hover:border-amber-800'
                                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 dark:hover:border-emerald-800'
                            }`}
                            title={prod.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          >
                            {prod.status === 'ACTIVE' ? <BlockIcon style={{ fontSize: 16 }} /> : <CheckIcon style={{ fontSize: 16 }} />}
                          </button>
                          <button
                            onClick={() => openEdit(prod)}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
                            title="Edit"
                          >
                            <EditIcon style={{ fontSize: 16 }} />
                          </button>
                          <button
                            onClick={() => confirmDelete(prod)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {editing ? 'Edit Product' : 'New Product'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <CloseIcon style={{ fontSize: 20 }} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              {/* Inline error banner */}
              {modalError && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400 text-sm font-medium">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>{modalError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Product Name *</label>
                  <input {...register('name', { required: 'Name is required' })} className={inputClass} placeholder="e.g. Wireless Mouse" />
                  {errors.name && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">SKU *</label>
                  <input {...register('sku', { required: 'SKU is required' })} className={`${inputClass} font-mono`} placeholder="e.g. RTL-10001" />
                  {errors.sku && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.sku.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
                  <select {...register('category_id')} className={inputClass}>
                    <option value="">Uncategorized</option>
                    {categories.map((c: Category) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Brand</label>
                  <input {...register('brand')} className={inputClass} placeholder="e.g. Acme" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Description</label>
                <textarea {...register('description')} rows={2} className={`${inputClass} resize-none`} placeholder="Optional product description" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Unit Price *</label>
                  <input type="number" step="0.01" min="0" {...register('unit_price', { required: true, valueAsNumber: true, min: 0.01 })} className={inputClass} />
                  {errors.unit_price && <p className="text-red-500 text-[10px] mt-1 font-semibold">Must be &gt; 0</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Cost Price *</label>
                  <input type="number" step="0.01" min="0" {...register('cost_price', { required: true, valueAsNumber: true, min: 0 })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Stock Qty *</label>
                  <input type="number" min="0" {...register('stock_quantity', { required: true, valueAsNumber: true, min: 0 })} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Unit of Measure</label>
                  <select {...register('unit_of_measure')} className={inputClass}>
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
                  <select {...register('status')} className={inputClass}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
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
export default Products;
