import React from 'react';
import { formatCurrency } from '../../utils/currency';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { getSale } from '../../api/saleApi';
import { jsPDF } from 'jspdf';
import _autoTable from 'jspdf-autotable';
import {
  ArrowBack as ArrowBackIcon,
  Print as PrintIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
} from '@mui/icons-material';

const currency = formatCurrency;

export const SaleDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: sale, isLoading, isError } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => getSale(id!),
    enabled: !!id,
  });

  const handleExportCSV = async () => {
    try {
      if (!sale || !sale.items.length) {
        alert('No data to export');
        return;
      }
      const headers = ['Product', 'Category', 'Qty', 'Unit Price', 'Discount', 'Tax', 'Total'];
      const rows = sale.items.map(item => [
        item.product?.name || '—',
        item.category?.name || '—',
        item.quantity,
        item.unit_price,
        item.discount,
        item.tax,
        item.total,
      ]);
      const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sale.invoice_number}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export as CSV');
    }
  };

  const handleExportPDF = async () => {
    try {
      if (!sale || !sale.items.length) {
        alert('No data to export');
        return;
      }
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Invoice', 14, 15);
      doc.setFontSize(10);
      doc.text(`Invoice Number: ${sale.invoice_number}`, 14, 22);
      doc.text(`Date: ${new Date(sale.sale_date).toLocaleString()}`, 14, 27);
      doc.text(`Customer: ${sale.customer_name || 'Walk-in Customer'}`, 14, 32);
      doc.text(`Salesperson: ${sale.created_by_name || '—'}`, 14, 37);
      doc.text(`Payment Method: ${sale.payment_method}`, 14, 42);
      doc.text(`Status: ${sale.status}`, 14, 47);
      const tableRows = sale.items.map(item => [
        item.product?.name || '—',
        item.product?.sku || '—',
        item.category?.name || '—',
        item.quantity.toString(),
        formatCurrency(item.unit_price),
        formatCurrency(item.discount),
        formatCurrency(item.tax),
        formatCurrency(item.total),
      ]);
      (doc as any).autoTable({
        head: [['Product', 'SKU', 'Category', 'Qty', 'Unit Price', 'Discount', 'Tax', 'Total']],
        body: tableRows,
        startY: 52,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229] },
      });
      const finalY = (doc as any).lastAutoTable.finalY || 52;
      const subtotal = sale.items.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);
      const totalDiscount = sale.items.reduce((sum, it) => sum + it.discount, 0);
      const totalTax = sale.items.reduce((sum, it) => sum + it.tax, 0);
      const grandTotal = subtotal - totalDiscount + totalTax;
      doc.setFontSize(10);
      doc.text(`Subtotal: ${formatCurrency(subtotal)}`, 14, finalY + 8);
      doc.text(`Discount: -${formatCurrency(totalDiscount)}`, 14, finalY + 13);
      doc.text(`Tax: ${formatCurrency(totalTax)}`, 14, finalY + 18);
      doc.setFontSize(12);
      doc.text(`Grand Total: ${formatCurrency(grandTotal)}`, 14, finalY + 23);
      doc.save(`${sale.invoice_number}.pdf`);
    } catch {
      alert('Failed to export as PDF');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (isError || !sale) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-sm text-red-600 font-medium">Sale not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sales')}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
          >
            <ArrowBackIcon style={{ fontSize: 20 }} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {sale.invoice_number}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Sale Details
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-white text-xs font-bold tracking-wide shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30"
            style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
            title="Export as CSV"
          >
            <CsvIcon style={{ fontSize: 16 }} />
            CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-white text-xs font-bold tracking-wide shadow-lg shadow-rose-500/20 transition-all hover:shadow-rose-500/30"
            style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)' }}
            title="Export as PDF"
          >
            <PdfIcon style={{ fontSize: 16 }} />
            PDF
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold tracking-wide shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}
          >
            <PrintIcon style={{ fontSize: 17 }} />
            Print Invoice
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Invoice Details</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Invoice Number</div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">{sale.invoice_number}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sale Date</div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">{new Date(sale.sale_date).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</div>
            <div className="mt-1">
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold capitalize tracking-wide ${
                sale.status === 'COMPLETED' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' :
                sale.status === 'DRAFT' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30' :
                'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30'
              }`}>
                {sale.status.toLowerCase()}
              </span>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">{sale.customer_name || 'Walk-in Customer'}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sales Channel</div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">{sale.sales_channel}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payment Method</div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">{sale.payment_method}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Salesperson</div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">{sale.created_by_name || '—'}</div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Product Details</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-3 font-bold">Product</th>
                <th className="px-6 py-3 font-bold">Category</th>
                <th className="px-6 py-3 font-bold">Qty</th>
                <th className="px-6 py-3 font-bold">Unit Price</th>
                <th className="px-6 py-3 font-bold">Discount</th>
                <th className="px-6 py-3 font-bold">Tax</th>
                <th className="px-6 py-3 font-bold text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/60">
                  <td className="px-6 py-3.5">
                    <div className="font-bold text-slate-800 dark:text-slate-100">{item.product?.name || '—'}</div>
                    {item.product?.sku && <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{item.product.sku}</div>}
                  </td>
                  <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">{item.category?.name || '—'}</td>
                  <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">{item.quantity}</td>
                  <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">{currency(item.unit_price)}</td>
                  <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">{currency(item.discount)}</td>
                  <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">{currency(item.tax)}</td>
                  <td className="px-6 py-3.5 text-right font-semibold text-slate-800 dark:text-slate-100">{currency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Pricing Breakdown</h2>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
            <span>Subtotal</span>
            <span className="font-mono">{currency(sale.items.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0))}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
            <span>Discount Applied</span>
            <span className="font-mono text-red-600">-{currency(sale.items.reduce((sum, it) => sum + it.discount, 0))}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
            <span>Tax</span>
            <span className="font-mono">{currency(sale.items.reduce((sum, it) => sum + it.tax, 0))}</span>
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex justify-between text-lg font-extrabold text-slate-900 dark:text-white">
            <span>Final Amount</span>
            <span className="font-mono">{currency(sale.total_amount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SaleDetails;
