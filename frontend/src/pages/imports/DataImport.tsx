import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  getImportHistory,
  validateImport,
  processImport,
  type ImportPreviewResponse,
  type ImportResultResponse,
  type ImportHistoryItem,
  type ImportType,
} from '../../api/importApi';
import {
  CloudUpload as CloudUploadIcon,
  Error as ErrorIcon,
  Download as DownloadIcon,
  History as HistoryIcon,
  PlayArrow as PlayIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  TableChart as TableIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';

const IMPORT_TYPES: { value: ImportType; label: string }[] = [
  { value: 'PRODUCTS', label: 'Products' },
  { value: 'CUSTOMERS', label: 'Customers' },
  { value: 'SALES', label: 'Sales Transactions' },
];

const REQUIRED_COLUMNS: Record<ImportType, string[]> = {
  PRODUCTS: ['Product Name', 'SKU', 'Category', 'Unit Price', 'Stock Quantity'],
  CUSTOMERS: ['Name', 'Email', 'Phone'],
  SALES: ['Customer', 'Product', 'Quantity', 'Unit Price', 'Sale Date'],
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
  PROCESSING: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40',
  COMPLETED: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40',
  COMPLETED_WITH_ERRORS: 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/40',
  FAILED: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40',
};

export const DataImport: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<ImportType>('PRODUCTS');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<'select' | 'preview' | 'result'>('select');
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [result, setResult] = useState<ImportResultResponse | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['importHistory'],
    queryFn: () => getImportHistory({ limit: 50 }),
    enabled: isAdmin,
  });

  const validateMutation = useMutation<ImportPreviewResponse, Error, File>({
    mutationFn: (file: File) => validateImport(importType, file),
    onSuccess: (data) => {
      setPreview(data);
      setPhase('preview');
      showNotification('Validation complete. Review the preview below.', 'success');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Validation failed';
      showNotification(msg, 'error');
    },
  });

  const processMutation = useMutation<ImportResultResponse, Error, File>({
    mutationFn: (file: File) => processImport(importType, file),
    onSuccess: (data) => {
      setResult(data);
      setPhase('result');
      queryClient.invalidateQueries({ queryKey: ['importHistory'] });
      if (data.failed_records === 0) {
        showNotification('Import completed successfully', 'success');
      } else {
        showNotification(`Import completed with ${data.failed_records} failed records`, 'error');
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Import failed';
      showNotification(msg, 'error');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showNotification('Only CSV files are allowed', 'error');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showNotification('File size exceeds 50MB limit', 'error');
      return;
    }
    setSelectedFile(file);
  };

  const handleValidate = async () => {
    if (!selectedFile) return;
    validateMutation.mutate(selectedFile);
  };

  const handleProcess = async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    try {
      await processMutation.mutateAsync(selectedFile);
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setPhase('select');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadErrors = () => {
    const errors = (result?.errors || preview?.errors || []) as Array<{ row_number: number; field: string | null; error_message: string; raw_data: string | null }>;
    if (!errors.length) return;
    const headers = ['Row', 'Field', 'Error', 'Raw Data'];
    const rows = errors.map((e: { row_number: number; field: string | null; error_message: string; raw_data: string | null }) => [e.row_number, e.field || '', e.error_message, (e.raw_data || '').replace(/,/g, ';')]);
    const csv = [headers.join(','), ...rows.map((r: (string | number | boolean)[]) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${result?.import_id || preview?.import_id || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-sm font-semibold text-slate-500">You do not have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Data Import</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Import products, customers, and sales transactions from CSV files.</p>
        </div>
      </div>

      {phase === 'select' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6 space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Import Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {IMPORT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setImportType(type.value)}
                  className={`px-4 py-3 rounded-xl text-sm font-bold border transition-all ${
                    importType === type.value
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">Required columns: {REQUIRED_COLUMNS[importType].join(', ')}</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Upload CSV File</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-all"
            >
              <CloudUploadIcon className="text-slate-400 mb-2" style={{ fontSize: 36 }} />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Click to upload or drag and drop</p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">CSV files only, max 50MB</p>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            </div>
            {selectedFile && (
              <div className="mt-3 flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 min-w-0">
                  <TableIcon className="text-indigo-500 shrink-0" style={{ fontSize: 18 }} />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{selectedFile.name}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                </div>
                <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <CloseIcon style={{ fontSize: 16 }} />
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleValidate}
              disabled={!selectedFile || validateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60 transition-all"
            >
              <VisibilityIcon style={{ fontSize: 16 }} />
              {validateMutation.isPending ? 'Validating...' : 'Validate & Preview'}
            </button>
          </div>
        </div>
      )}

      {phase === 'preview' && preview && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Validation Summary</h2>
              <button onClick={handleReset} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <ArrowBackIcon style={{ fontSize: 18 }} />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Total Records</p>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white">{preview.total_records}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Valid Records</p>
                <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">{preview.valid_records}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40">
                <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase">Invalid Records</p>
                <p className="text-lg font-extrabold text-red-700 dark:text-red-300">{preview.invalid_records}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">Duplicate Records</p>
                <p className="text-lg font-extrabold text-amber-700 dark:text-amber-300">{preview.duplicate_records}</p>
              </div>
            </div>

            {preview.errors.length > 0 && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40">
                <p className="text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
                  <ErrorIcon style={{ fontSize: 16 }} />
                  Validation Issues Found
                </p>
                <div className="mt-2 max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-red-500 dark:text-red-400">
                        <th className="px-3 py-2 font-bold">Row</th>
                        <th className="px-3 py-2 font-bold">Field</th>
                        <th className="px-3 py-2 font-bold">Error</th>
                      </tr>
                    </thead>
                     <tbody>
                       {(preview.errors as Array<{ row_number: number; field: string | null; error_message: string }>).map((err, idx) => (
                         <tr key={idx} className="border-b border-red-100 dark:border-red-900/40">
                           <td className="px-3 py-2 text-red-700 dark:text-red-300 font-mono">{err.row_number}</td>
                           <td className="px-3 py-2 text-red-700 dark:text-red-300">{err.field || '-'}</td>
                           <td className="px-3 py-2 text-red-700 dark:text-red-300">{err.error_message}</td>
                         </tr>
                       ))}
                     </tbody>
                  </table>
                </div>
              </div>
            )}

            {preview.preview_rows.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Preview (first {preview.preview_rows.length} rows)</p>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800">
                        {(preview.columns as string[]).map((col: string) => (
                          <th key={col} className="px-3 py-2 font-bold">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(preview.preview_rows as Array<Record<string, string>>).map((row: Record<string, string>, idx: number) => (
                        <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/60">
                          {(preview.columns as string[]).map((col: string) => (
                            <td key={col} className="px-3 py-2 text-slate-700 dark:text-slate-200">{row[col] || ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={handleReset} className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                Cancel
              </button>
              <button
                onClick={handleProcess}
                disabled={isImporting || preview.valid_records === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-500/10 hover:bg-indigo-700 disabled:opacity-60 transition-all"
              >
                <PlayIcon style={{ fontSize: 16 }} />
                {isImporting ? 'Importing...' : `Import ${preview.valid_records} Valid Records`}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'result' && result && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Import Result</h2>
              <button onClick={handleReset} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <ArrowBackIcon style={{ fontSize: 18 }} />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Total Records</p>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white">{result.total_records}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Successfully Added</p>
                <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">{result.successful_records}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">Duplicates</p>
                <p className="text-lg font-extrabold text-amber-700 dark:text-amber-300">{result.duplicate_records}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40">
                <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase">Failed</p>
                <p className="text-lg font-extrabold text-red-700 dark:text-red-300">{result.failed_records}</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
                    <ErrorIcon style={{ fontSize: 16 }} />
                    Failed Records
                  </p>
                  <button onClick={downloadErrors} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/40 text-xs font-bold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 transition-all">
                    <DownloadIcon style={{ fontSize: 14 }} />
                    Download Errors
                  </button>
                </div>
                <div className="mt-2 max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-red-500 dark:text-red-400">
                        <th className="px-3 py-2 font-bold">Row</th>
                        <th className="px-3 py-2 font-bold">Field</th>
                        <th className="px-3 py-2 font-bold">Error</th>
                      </tr>
                    </thead>
                     <tbody>
                       {(result.errors as Array<{ row_number: number; field: string | null; error_message: string }>).map((err, idx) => (
                         <tr key={idx} className="border-b border-red-100 dark:border-red-900/40">
                           <td className="px-3 py-2 text-red-700 dark:text-red-300 font-mono">{err.row_number}</td>
                           <td className="px-3 py-2 text-red-700 dark:text-red-300">{err.field || '-'}</td>
                           <td className="px-3 py-2 text-red-700 dark:text-red-300">{err.error_message}</td>
                         </tr>
                       ))}
                     </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={handleReset} className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-500/10 hover:bg-indigo-700 transition-all">
                New Import
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <HistoryIcon style={{ fontSize: 18 }} />
            Import History
          </h2>
        </div>
        {historyLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-6">
            <HistoryIcon className="text-slate-300 dark:text-slate-700" style={{ fontSize: 36 }} />
            <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-400">No import history yet</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Upload a CSV file to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-3 font-bold">Import ID</th>
                  <th className="px-6 py-3 font-bold">Type</th>
                  <th className="px-6 py-3 font-bold">Filename</th>
                  <th className="px-6 py-3 font-bold">Total</th>
                  <th className="px-6 py-3 font-bold">Success</th>
                  <th className="px-6 py-3 font-bold">Failed</th>
                  <th className="px-6 py-3 font-bold">Duplicates</th>
                  <th className="px-6 py-3 font-bold">Status</th>
                  <th className="px-6 py-3 font-bold">Uploaded At</th>
                </tr>
              </thead>
              <tbody>
                {(history as ImportHistoryItem[]).map((item: ImportHistoryItem) => (
                  <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10 transition-colors">
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-500 dark:text-slate-400">{item.id.slice(0, 8)}...</td>
                    <td className="px-6 py-3.5 text-slate-700 dark:text-slate-200">{item.import_type}</td>
                    <td className="px-6 py-3.5 text-slate-700 dark:text-slate-200 truncate max-w-[180px]">{item.filename}</td>
                    <td className="px-6 py-3.5 text-slate-700 dark:text-slate-200">{item.total_records}</td>
                    <td className="px-6 py-3.5 text-emerald-700 dark:text-emerald-300">{item.successful_records}</td>
                    <td className="px-6 py-3.5 text-red-700 dark:text-red-300">{item.failed_records}</td>
                    <td className="px-6 py-3.5 text-amber-700 dark:text-amber-300">{item.duplicate_records}</td>
                    <td className="px-6 py-3.5">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${STATUS_COLORS[item.status] || STATUS_COLORS.PENDING}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 text-xs">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataImport;
