import React from 'react';
import { ShoppingBag as BagIcon } from '@mui/icons-material';
import { formatCurrency } from '../../../utils/currency';
import type { TopProductResponse } from '../../../api/analyticsApi';
import { Pagination } from '../../../components/Pagination';

interface TopProductsTableProps {
  products: TopProductResponse[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  sortBy: 'total_revenue' | 'total_quantity';
  onSortChange: (value: 'total_revenue' | 'total_quantity') => void;
}

const TopProductsTable: React.FC<TopProductsTableProps> = ({
  products,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  sortBy,
  onSortChange,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
        <div className="flex items-center gap-2">
          <BagIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Top Performing Products</h2>
        </div>
        <select
          value={sortBy}
          onChange={(e) => { onSortChange(e.target.value as 'total_revenue' | 'total_quantity'); onPageChange(1); }}
          className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="total_revenue">Sort by Revenue</option>
          <option value="total_quantity">Sort by Units Sold</option>
        </select>
      </div>
      <div className="p-4 overflow-x-auto">
        {loading ? (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            ))}
          </div>
        ) : products && products.length > 0 ? (
          <>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Units Sold</th>
                  <th className="p-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {products.map((p) => (
                  <tr key={p.product_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{p.product_name}</td>
                    <td className="p-3 font-mono text-slate-500">{p.sku}</td>
                    <td className="p-3">{p.category_name || 'Uncategorized'}</td>
                    <td className="p-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{p.total_quantity.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(p.total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
            <BagIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
            <span className="text-xs font-semibold">No top products data available</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopProductsTable;
