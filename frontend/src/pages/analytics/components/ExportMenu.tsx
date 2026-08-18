import React from 'react';
import {
  FileDownload as ExportIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
} from '@mui/icons-material';

interface ExportMenuProps {
  onExportCSV: (reportType: ExportRequest['report_type']) => void;
  onExportPDF: (reportType: ExportRequest['report_type']) => void;
  exportingType: string | null;
  setExportingType: (type: string | null) => void;
}

const ExportMenu: React.FC<ExportMenuProps> = ({ onExportCSV, onExportPDF, exportingType, setExportingType }) => {
  return (
    <div className="relative group">
      <button className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md shadow-indigo-600/20">
        <ExportIcon style={{ fontSize: 16 }} />
        <span>Export Report</span>
      </button>
      <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all p-2 space-y-1">
        <div className="px-2 py-1 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">CSV Reports</div>
        <button onClick={() => onExportCSV('kpis')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><CsvIcon fontSize="small" className="text-emerald-500" /> KPI Dashboard</span>
          <span className="text-[10px] text-slate-400">CSV</span>
        </button>
        <button onClick={() => onExportCSV('sales')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><CsvIcon fontSize="small" className="text-emerald-500" /> Sales Analytics</span>
          <span className="text-[10px] text-slate-400">CSV</span>
        </button>
        <button onClick={() => onExportCSV('inventory')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><CsvIcon fontSize="small" className="text-emerald-500" /> Inventory Summary</span>
          <span className="text-[10px] text-slate-400">CSV</span>
        </button>
        <button onClick={() => onExportCSV('transactions')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><CsvIcon fontSize="small" className="text-emerald-500" /> Sales Transactions</span>
          <span className="text-[10px] text-slate-400">CSV</span>
        </button>
        <button onClick={() => onExportCSV('top-products')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><CsvIcon fontSize="small" className="text-emerald-500" /> Top Products</span>
          <span className="text-[10px] text-slate-400">CSV</span>
        </button>
        <button onClick={() => onExportCSV('top-customers')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><CsvIcon fontSize="small" className="text-emerald-500" /> Top Customers</span>
          <span className="text-[10px] text-slate-400">CSV</span>
        </button>
        <button onClick={() => onExportCSV('payment-methods')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><CsvIcon fontSize="small" className="text-emerald-500" /> Payment Methods</span>
          <span className="text-[10px] text-slate-400">CSV</span>
        </button>

        <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
        <div className="px-2 py-1 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">PDF Reports</div>
        <button onClick={() => onExportPDF('kpis')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><PdfIcon fontSize="small" className="text-rose-500" /> KPI Dashboard</span>
          <span className="text-[10px] text-slate-400">PDF</span>
        </button>
        <button onClick={() => onExportPDF('sales')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><PdfIcon fontSize="small" className="text-rose-500" /> Sales Analytics</span>
          <span className="text-[10px] text-slate-400">PDF</span>
        </button>
        <button onClick={() => onExportPDF('inventory')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><PdfIcon fontSize="small" className="text-rose-500" /> Inventory Summary</span>
          <span className="text-[10px] text-slate-400">PDF</span>
        </button>
        <button onClick={() => onExportPDF('transactions')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><PdfIcon fontSize="small" className="text-rose-500" /> Sales Transactions</span>
          <span className="text-[10px] text-slate-400">PDF</span>
        </button>
        <button onClick={() => onExportPDF('top-products')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><PdfIcon fontSize="small" className="text-rose-500" /> Top Products</span>
          <span className="text-[10px] text-slate-400">PDF</span>
        </button>
        <button onClick={() => onExportPDF('top-customers')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><PdfIcon fontSize="small" className="text-rose-500" /> Top Customers</span>
          <span className="text-[10px] text-slate-400">PDF</span>
        </button>
        <button onClick={() => onExportPDF('payment-methods')} className="w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><PdfIcon fontSize="small" className="text-rose-500" /> Payment Methods</span>
          <span className="text-[10px] text-slate-400">PDF</span>
        </button>
      </div>
    </div>
  );
};

export default ExportMenu;
