import React from 'react';
import {
  FilterList as FilterListIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { type AnalyticsFilters } from '../../api/analyticsApi';
import { getProducts, getCategories, getBrands, getCustomers } from '../../api/analyticsApi';
import { useQuery } from '@tanstack/react-query';

const inputClass =
  'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition-all';

interface FilterBarProps {
  filters: AnalyticsFilters;
  updateFilter: (key: keyof AnalyticsFilters, value: string | undefined) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, updateFilter, clearFilters, hasActiveFilters }) => {
  const { data: rawProducts } = useQuery({ queryKey: ['analytics', 'products'], queryFn: () => getProducts({ status: 'ACTIVE' }) });
  const products = (rawProducts || []) as any[];
  const { data: rawCategories } = useQuery({ queryKey: ['analytics', 'categories'], queryFn: getCategories });
  const categories = (rawCategories || []) as any[];
  const { data: rawBrands } = useQuery({ queryKey: ['analytics', 'brands'], queryFn: getBrands });
  const brands = (rawBrands || []) as string[];
  const { data: rawCustomers } = useQuery({ queryKey: ['analytics', 'customers'], queryFn: () => getCustomers({ status: 'ACTIVE' }) });
  const customers = (rawCustomers || []) as any[];

  return (
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
  );
};

export default FilterBar;
