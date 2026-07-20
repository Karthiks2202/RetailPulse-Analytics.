import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../api/categoryApi';
import type { Category, CategoryCreate } from '../../api/categoryApi';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Category as CategoryIcon,
  Inventory2 as InventoryIcon,
} from '@mui/icons-material';

interface CategoryFormValues {
  name: string;
  description: string;
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

export const Categories: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const { data: categories = [], isLoading, isError } = useQuery({
    queryKey: ['categories', search],
    queryFn: () => getCategories(search || undefined),
  });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CategoryFormValues>({
    defaultValues: { name: '', description: '', status: 'ACTIVE' },
  });

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', description: '', status: 'ACTIVE' });
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setValue('name', cat.name);
    setValue('description', cat.description || '');
    setValue('status', cat.status);
    setModalOpen(true);
  };

  const mutation = useMutation({
    mutationFn: (values: CategoryFormValues) => {
      const payload = {
        name: values.name,
        description: values.description || undefined,
        status: values.status,
      };
      return editing ? updateCategory(editing.id, payload) : createCategory(payload as CategoryCreate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      showNotification(editing ? 'Category updated successfully' : 'Category created successfully', 'success');
      setModalOpen(false);
    },
    onError: (err: any) => {
      showNotification(err?.response?.data?.error || 'Failed to save category', 'error');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      showNotification('Category deleted successfully', 'success');
    },
    onError: (err: any) => {
      showNotification(err?.response?.data?.error || 'Failed to delete category', 'error');
    },
  });

  const onSubmit = (values: CategoryFormValues) => {
    mutation.mutate(values);
  };

  const confirmDelete = (cat: Category) => {
    if (window.confirm(`Delete category "${cat.name}"? This cannot be undone.`)) {
      removeMutation.mutate(cat.id);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Categories</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Organize your product master data into manageable groups.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold tracking-wide shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}
          >
            <AddIcon style={{ fontSize: 17 }} />
            + New Category
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 18 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories by name..."
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg pl-10 pr-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition-all duration-150"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          </div>
        ) : isError ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-red-600 font-medium">Failed to load categories.</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-6">
            <CategoryIcon className="text-slate-300 dark:text-slate-700" style={{ fontSize: 48 }} />
            <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-400">No categories found</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Create your first category to start grouping products.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-3 font-bold">Category Name</th>
                  <th className="px-6 py-3 font-bold">Description</th>
                  <th className="px-6 py-3 font-bold">Products</th>
                  <th className="px-6 py-3 font-bold">Status</th>
                  {isAdmin && <th className="px-6 py-3 font-bold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{cat.name}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">{cat.description || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <InventoryIcon style={{ fontSize: 16 }} className="text-indigo-500" />
                        {cat.product_count}
                      </span>
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={cat.status} /></td>
                    {isAdmin && (
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(cat)}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
                            title="Edit"
                          >
                            <EditIcon style={{ fontSize: 16 }} />
                          </button>
                          <button
                            onClick={() => confirmDelete(cat)}
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
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {editing ? 'Edit Category' : 'New Category'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <CloseIcon style={{ fontSize: 20 }} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category Name</label>
                <input
                  {...register('name', { required: 'Name is required' })}
                  placeholder="e.g. Beverages"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none"
                />
                {errors.name && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Description</label>
                <textarea
                  {...register('description')}
                  rows={3}
                  placeholder="Optional description"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
                <select
                  {...register('status')}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
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
export default Categories;
