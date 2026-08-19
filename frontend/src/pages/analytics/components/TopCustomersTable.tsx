import React from 'react';
import { People as PeopleIcon } from '@mui/icons-material';
import { formatCurrency } from '../../../utils/currency';
import type { TopCustomerResponse } from '../../../api/customerApi';
import { Pagination } from '../../../components/Pagination';

interface TopCustomersTableProps {
  customers: TopCustomerResponse[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

const TopCustomersTable: React.FC<TopCustomersTableProps> = ({
  customers,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
        <PeopleIcon className="text-indigo-600 dark:text-indigo-400" fontSize="small" />
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Top Customers by Revenue</h2>
      </div>
      <div className="p-4 overflow-x-auto">
        {loading ? (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            ))}
          </div>
        ) : customers && customers.length > 0 ? (
          <>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3 text-center">Orders</th>
                  <th className="p-3 text-right">Total Spend</th>
                  <th className="p-3 text-right">Avg Order Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {customers.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 text-slate-500 font-mono">{idx + 1 + (page - 1) * pageSize}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{c.first_name} {c.last_name}</div>
                      <div className="text-[10px] text-slate-400">{c.email || '—'}</div>
                    </td>
                    <td className="p-3 text-center font-bold">{c.total_purchases}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(c.total_spent)}</td>
                    <td className="p-3 text-right font-mono text-indigo-600 dark:text-indigo-400">{formatCurrency(c.average_order_value || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
            <PeopleIcon style={{ fontSize: 36 }} className="text-slate-300 dark:text-slate-700" />
            <span className="text-xs font-semibold">No customer data available</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopCustomersTable;
