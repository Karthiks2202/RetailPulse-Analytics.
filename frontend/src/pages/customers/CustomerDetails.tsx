import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCustomer, getCustomerPurchaseHistory, type Customer } from '../../api/customerApi';
import {
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';

const SegmentBadge: React.FC<{ segment: Customer['segment'] }> = ({ segment }) => {
  const styles: Record<string, string> = {
    NEW: 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-900/30',
    REGULAR: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/30',
    LOYAL: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30',
    VIP: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30',
  };
  const label = segment ? segment.charAt(0) + segment.slice(1).toLowerCase() : '—';
  return (
    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold capitalize tracking-wide ${segment ? styles[segment] || styles.NEW : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'}`}>
      {label}
    </span>
  );
};

export const CustomerDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: customer, isLoading, isError } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id!),
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['customer-history', id],
    queryFn: () => getCustomerPurchaseHistory(id!, 10),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-sm text-red-600 font-medium">Customer not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/customers')}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
          >
            <ArrowBackIcon style={{ fontSize: 20 }} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {customer.first_name} {customer.last_name}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Customer Details
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Customer Information</h3>
          <div className="space-y-2 text-xs">
            <div><span className="text-slate-400">Name:</span> <span className="font-semibold text-slate-800 dark:text-slate-100">{customer.first_name} {customer.last_name}</span></div>
            <div><span className="text-slate-400">Email:</span> <span className="font-semibold text-slate-800 dark:text-slate-100">{customer.email || '—'}</span></div>
            <div><span className="text-slate-400">Phone:</span> <span className="font-semibold text-slate-800 dark:text-slate-100">{customer.phone || '—'}</span></div>
            <div><span className="text-slate-400">Segment:</span> <SegmentBadge segment={customer.segment} /></div>
            <div><span className="text-slate-400">Status:</span> <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${customer.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{customer.status.toLowerCase()}</span></div>
          </div>
        </div>
        <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Contact Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div><span className="text-slate-400">Address:</span> <span className="font-semibold text-slate-800 dark:text-slate-100">{customer.address || '—'}</span></div>
            <div><span className="text-slate-400">City:</span> <span className="font-semibold text-slate-800 dark:text-slate-100">{customer.city || '—'}</span></div>
            <div><span className="text-slate-400">State:</span> <span className="font-semibold text-slate-800 dark:text-slate-100">{customer.state || '—'}</span></div>
            <div><span className="text-slate-400">Country:</span> <span className="font-semibold text-slate-800 dark:text-slate-100">{customer.country || '—'}</span></div>
            <div><span className="text-slate-400">Postal Code:</span> <span className="font-semibold text-slate-800 dark:text-slate-100">{customer.postal_code || '—'}</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Orders</p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white">{customer.total_purchases}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Spend</p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white">${customer.total_spent.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Purchase</p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white">{customer.last_purchase_date ? new Date(customer.last_purchase_date).toLocaleDateString() : '—'}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Since</p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white">{new Date(customer.customer_since).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Recent Purchase History</h2>
        </div>
        <div className="p-6">
          {history.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No purchase history yet.</p>
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
                  {history.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/60">
                      <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">{item.invoice_number}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{new Date(item.sale_date).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{item.sales_channel}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{item.payment_method}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold capitalize tracking-wide ${
                          item.status === 'COMPLETED' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' :
                          item.status === 'DRAFT' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30' :
                          'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30'
                        }`}>
                          {item.status.toLowerCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-slate-100">${item.total_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerDetails;
