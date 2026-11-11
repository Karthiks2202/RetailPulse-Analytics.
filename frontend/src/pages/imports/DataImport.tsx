import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  getImportHistory,
  getImportStatus,
  getImportErrors,
  uploadImport,
  validateImport,
  processImport,
  cancelImport,
  downloadTemplate,
  downloadErrorReport,
  type ImportPreviewResponse,
  type ImportResultResponse,
  type ImportStatusResponse,
  type ImportHistoryItem,
  type ImportErrorItem,
  type ImportType,
  type DuplicateStrategy,
} from '../../api/importApi';
import {
  CloudUpload as CloudUploadIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Download as DownloadIcon,
  History as HistoryIcon,
  PlayArrow as PlayIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  TableChart as TableIcon,
  ArrowBack as ArrowBackIcon,
  Stop as StopIcon,
  Search as SearchIcon,
  VerifiedUser as ShieldIcon,
  Inventory as InventoryIcon,
  ShoppingBag as ShoppingBagIcon,
  People as PeopleIcon,
  ReceiptLong as ReceiptLongIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

interface ImportTypeOption {
  value: ImportType;
  label: string;
  description: string;
  icon: React.ComponentType<{ style?: React.CSSProperties; className?: string }>;
}

const IMPORT_TYPES: ImportTypeOption[] = [
  {
    value: 'PRODUCTS',
    label: 'Products',
    description: 'Catalog items, SKUs, categories, unit prices, and initial stock quantities.',
    icon: ShoppingBagIcon,
  },
  {
    value: 'INVENTORY',
    label: 'Inventory',
    description: 'Stock additions (STOCK_IN), removals (STOCK_OUT), and manual reconciliation adjustments.',
    icon: InventoryIcon,
  },
  {
    value: 'CUSTOMERS',
    label: 'Customers',
    description: 'Customer profiles, email addresses, phone contacts, and membership tiers.',
    icon: PeopleIcon,
  },
  {
    value: 'SALES',
    label: 'Sales Transactions',
    description: 'Historical or batched sales orders, line item details, and invoice records.',
    icon: ReceiptLongIcon,
  },
];

const REQUIRED_COLUMNS: Record<ImportType, string[]> = {
  PRODUCTS: ['Product Name', 'SKU', 'Category', 'Unit Price', 'Stock Quantity'],
  INVENTORY: ['SKU', 'Adjustment Type', 'Quantity', 'Reason', 'Remarks (Optional)'],
  CUSTOMERS: ['Name', 'Email', 'Phone', 'Customer Type (Optional)'],
  SALES: ['Customer', 'Product', 'Quantity', 'Unit Price', 'Sale Date', 'Invoice Number'],
};

const DUPLICATE_STRATEGIES: { value: DuplicateStrategy; label: string; description: string }[] = [
  {
    value: 'REJECT',
    label: 'Reject Duplicates',
    description: 'Fail and report duplicate records as validation errors. Best for strict catalog uniqueness.',
  },
  {
    value: 'SKIP',
    label: 'Skip Duplicates',
    description: 'Safely bypass duplicate rows and continue processing remaining records.',
  },
  {
    value: 'UPDATE',
    label: 'Update Existing',
    description: 'Overwrite matching items with incoming CSV values (e.g. updating stock or contact info).',
  },
];

const STATUS_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  PENDING: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700' },
  UPLOADED: { bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-200 dark:border-sky-800/60' },
  VALIDATING: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800/60' },
  PROCESSING: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800/60' },
  COMPLETED: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800/60' },
  COMPLETED_WITH_ERRORS: { bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800/60' },
  FAILED: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800/60' },
  CANCELLED: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-500 dark:text-slate-400', border: 'border-slate-300 dark:border-slate-700' },
};

export const DataImport: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard state
  const [importType, setImportType] = useState<ImportType>('PRODUCTS');
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('REJECT');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<'select' | 'preview' | 'processing' | 'result'>('select');
  const [activeImportId, setActiveImportId] = useState<string | null>(null);

  // Results & previews
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [result, setResult] = useState<ImportResultResponse | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  // History filtering & Modal detail state
  const [historyFilterType, setHistoryFilterType] = useState<string>('ALL');
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>('ALL');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ImportHistoryItem | null>(null);
  const [historyErrors, setHistoryErrors] = useState<ImportErrorItem[]>([]);
  const [isLoadingHistoryDetail, setIsLoadingHistoryDetail] = useState(false);

  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';

  // Import history query
  const { data: history = [], isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['importHistory', historyFilterType, historyFilterStatus],
    queryFn: () =>
      getImportHistory({
        import_type: historyFilterType !== 'ALL' ? historyFilterType : undefined,
        status: historyFilterStatus !== 'ALL' ? historyFilterStatus : undefined,
        limit: 100,
      }),
    enabled: isAdmin,
  });

  // Polling import status during active processing
  const { data: liveStatus } = useQuery<ImportStatusResponse>({
    queryKey: ['importLiveStatus', activeImportId],
    queryFn: () => getImportStatus(activeImportId!),
    enabled: phase === 'processing' && !!activeImportId,
    refetchInterval: 1500,
  });

  // Effect to watch for job completion while polling
  useEffect(() => {
    if (phase === 'processing' && liveStatus) {
      if (['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED'].includes(liveStatus.status)) {
        // Fetch full errors and transition to result
        getImportErrors(liveStatus.import_id)
          .then((errs) => {
            setResult({
              import_id: liveStatus.import_id,
              import_type: liveStatus.import_type,
              filename: liveStatus.filename,
              total_records: liveStatus.total_records,
              successful_records: liveStatus.successful_records,
              failed_records: liveStatus.failed_records,
              skipped_records: liveStatus.skipped_records,
              duplicate_records: liveStatus.duplicate_records,
              status: liveStatus.status,
              duration_seconds: liveStatus.duration_seconds,
              errors: errs,
            });
            setPhase('result');
            queryClient.invalidateQueries({ queryKey: ['importHistory'] });
            if (liveStatus.status === 'COMPLETED') {
              showNotification('Import completed successfully!', 'success');
            } else if (liveStatus.status === 'COMPLETED_WITH_ERRORS') {
              showNotification(`Import finished with ${liveStatus.failed_records} failed records`, 'info');
            } else if (liveStatus.status === 'CANCELLED') {
              showNotification('Import processing was cancelled', 'info');
            } else {
              showNotification('Import processing failed', 'error');
            }
          })
          .catch(() => {
            setPhase('result');
          });
      }
    }
  }, [liveStatus, phase, queryClient, showNotification]);

  // Upload and Validate mutation
  const validateMutation = useMutation<ImportPreviewResponse, Error, File>({
    mutationFn: async (file: File) => {
      const uploadData = await uploadImport(importType, file, duplicateStrategy);
      setActiveImportId(uploadData.import_id);
      const previewData = await validateImport(importType, file, uploadData.import_id, duplicateStrategy);
      return previewData;
    },
    onSuccess: (data) => {
      setPreview(data);
      setPhase('preview');
      showNotification('CSV file validated. Review records and preview below.', 'success');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Validation failed. Please verify the CSV structure.';
      showNotification(msg, 'error');
    },
  });

  // Start processing mutation (Background processing)
  const processMutation = useMutation<ImportResultResponse, Error, void>({
    mutationFn: async () => {
      if (!selectedFile && !activeImportId) {
        throw new Error('No import selected');
      }
      return processImport(importType, selectedFile || undefined, activeImportId || undefined, duplicateStrategy, true);
    },
    onSuccess: (data) => {
      if (data.status === 'PROCESSING') {
        setActiveImportId(data.import_id);
        setPhase('processing');
        showNotification('Import job started in background. Monitoring progress...', 'info');
      } else {
        setResult(data);
        setPhase('result');
        queryClient.invalidateQueries({ queryKey: ['importHistory'] });
        if (data.status === 'COMPLETED') {
          showNotification('Import completed successfully', 'success');
        } else if (data.status === 'COMPLETED_WITH_ERRORS') {
          showNotification(`Import completed with ${data.failed_records} errors and ${data.skipped_records || 0} skipped records`, 'info');
        } else {
          showNotification(`Import finished with status: ${data.status}`, 'error');
        }
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Import failed during execution.';
      showNotification(msg, 'error');
      setPhase('preview');
    },
  });

  // File picker handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showNotification('Only CSV (.csv) files are allowed', 'error');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showNotification('File size exceeds the 50MB limit', 'error');
      return;
    }
    setSelectedFile(file);
  };

  const handleValidate = () => {
    if (!selectedFile) return;
    validateMutation.mutate(selectedFile);
  };

  const handleStartImport = () => {
    setPhase('processing');
    processMutation.mutate();
  };

  const handleCancelActiveImport = async () => {
    if (!activeImportId) return;
    try {
      await cancelImport(activeImportId);
      showNotification('Cancellation requested...', 'info');
    } catch (err: any) {
      showNotification(err?.response?.data?.detail || 'Failed to cancel import', 'error');
    }
  };

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      await downloadTemplate(importType);
      showNotification(`Downloaded ${importType.toLowerCase()} template`, 'success');
    } catch {
      showNotification('Failed to download template', 'error');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setActiveImportId(null);
    setPhase('select');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenHistoryDetail = async (item: ImportHistoryItem) => {
    setSelectedHistoryItem(item);
    setIsLoadingHistoryDetail(true);
    try {
      const errs = await getImportErrors(item.id);
      setHistoryErrors(errs);
    } catch {
      setHistoryErrors([]);
    } finally {
      setIsLoadingHistoryDetail(false);
    }
  };

  // Filter history items by search query
  const filteredHistory = history.filter((item) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return (
      item.id.toLowerCase().includes(q) ||
      item.filename.toLowerCase().includes(q) ||
      item.import_type.toLowerCase().includes(q) ||
      (item.uploaded_by_name && item.uploaded_by_name.toLowerCase().includes(q))
    );
  });

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <ShieldIcon className="text-amber-500 mb-3" style={{ fontSize: 48 }} />
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Access Restricted</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md">
          Only authorized Company Administrators and Super Administrators can perform data imports into RetailPulse.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <CloudUploadIcon className="text-indigo-600 dark:text-indigo-400" />
            Data Import & Bulk Processing
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Production-grade bulk ingestion for Products, Inventory, Customers, and Sales with duplicate detection and automated data quality audits.
          </p>
        </div>
      </div>

      {/* PHASE 1: CONFIGURATION & UPLOAD */}
      {phase === 'select' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
          {/* 1. Entity Type Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                1. Select Import Entity Type
              </label>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                disabled={isDownloadingTemplate}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors"
              >
                <DownloadIcon style={{ fontSize: 16 }} />
                {isDownloadingTemplate ? 'Downloading...' : `Download ${importType} Template`}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {IMPORT_TYPES.map((type) => {
                const IconComponent = type.icon;
                const isSelected = importType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setImportType(type.value)}
                    className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        <IconComponent style={{ fontSize: 20 }} />
                      </span>
                      {isSelected && <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-600 text-white">Active</span>}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{type.label}</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{type.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                <strong className="text-slate-700 dark:text-slate-200">Required Columns:</strong> {REQUIRED_COLUMNS[importType].join(' • ')}
              </span>
              <span className="text-[11px] text-slate-400">Accepted formats: .csv (UTF-8, comma/tab/semicolon)</span>
            </div>
          </div>

          {/* 2. Duplicate Handling Strategy */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              2. Duplicate Detection & Handling Rule
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {DUPLICATE_STRATEGIES.map((strat) => {
                const isSelected = duplicateStrategy === strat.value;
                return (
                  <label
                    key={strat.value}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50/40 dark:bg-indigo-950/30 border-indigo-500'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="duplicateStrategy"
                      value={strat.value}
                      checked={isSelected}
                      onChange={() => setDuplicateStrategy(strat.value)}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{strat.label}</div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{strat.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 3. CSV File Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              3. Upload CSV File
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-all text-center p-6"
            >
              <CloudUploadIcon className="text-indigo-500 dark:text-indigo-400 mb-2" style={{ fontSize: 40 }} />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Click to browse or drag and drop your CSV dataset here
              </p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Standard RFC 4180 CSV, maximum size 50MB</p>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            </div>

            {selectedFile && (
              <div className="mt-3 flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 min-w-0">
                  <TableIcon className="text-indigo-500 shrink-0" style={{ fontSize: 24 }} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{selectedFile.name}</p>
                    <p className="text-[11px] text-slate-400 font-medium">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <CloseIcon style={{ fontSize: 18 }} />
                </button>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <DownloadIcon style={{ fontSize: 16 }} />
              Download Template ({importType})
            </button>
            <button
              type="button"
              onClick={handleValidate}
              disabled={!selectedFile || validateMutation.isPending}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-500/20"
            >
              <VisibilityIcon style={{ fontSize: 16 }} />
              {validateMutation.isPending ? 'Validating File...' : 'Upload & Preview'}
            </button>
          </div>
        </div>
      )}

      {/* PHASE 2: VALIDATION PREVIEW */}
      {phase === 'preview' && preview && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <VisibilityIcon className="text-indigo-600 dark:text-indigo-400" />
                Import Validation & Preview
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                File: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{preview.filename}</span> • Strategy: <span className="font-bold text-indigo-600">{duplicateStrategy}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              <ArrowBackIcon style={{ fontSize: 16 }} />
              Choose Another File
            </button>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Total Rows</span>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{preview.total_records}</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Valid Rows</span>
              <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">{preview.valid_records}</p>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">Invalid Rows</span>
              <p className="text-2xl font-extrabold text-rose-700 dark:text-rose-300 mt-1">{preview.invalid_records}</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Duplicate Rows</span>
              <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">{preview.duplicate_records}</p>
            </div>
          </div>

          {/* Validation Errors Box */}
          {preview.errors.length > 0 && (
            <div className="p-4 rounded-xl bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                  <ErrorIcon style={{ fontSize: 18 }} />
                  Validation Issues Detected ({preview.errors.length})
                </span>
                <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  {duplicateStrategy === 'SKIP' ? 'Duplicates will be skipped' : duplicateStrategy === 'UPDATE' ? 'Existing records will be updated' : 'Duplicates are rejected'}
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-rose-200/60 dark:border-rose-900/40 bg-white dark:bg-slate-900">
                <table className="w-full text-xs">
                  <thead className="bg-rose-100/60 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300">
                    <tr className="text-left font-bold text-[10px] uppercase">
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Field</th>
                      <th className="px-3 py-2">Error Type</th>
                      <th className="px-3 py-2">Message</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 dark:divide-rose-950/40">
                    {preview.errors.map((err, i) => (
                      <tr key={i} className="hover:bg-rose-50/50 dark:hover:bg-rose-950/10">
                        <td className="px-3 py-2 font-mono font-bold text-rose-700 dark:text-rose-400">{err.row_number}</td>
                        <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">{err.field || '-'}</td>
                        <td className="px-3 py-2">
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                            {err.error_type || 'VALIDATION_ERROR'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-rose-800 dark:text-rose-300">{err.error_message}</td>
                        <td className="px-3 py-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">{err.processing_status || 'FAILED'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sample Rows Preview */}
          {preview.preview_rows.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Sample Normalized Records (First {preview.preview_rows.length} rows)
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <tr className="text-left font-bold text-[10px] uppercase">
                      {Object.keys(preview.preview_rows[0] || {}).map((col) => (
                        <th key={col} className="px-3 py-2.5 font-bold">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {preview.preview_rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300 truncate max-w-xs">
                            {String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Preview action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartImport}
              disabled={preview.valid_records === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-500/20"
            >
              <PlayIcon style={{ fontSize: 16 }} />
              {preview.valid_records === 0 ? 'No Valid Records to Import' : `Confirm & Import ${preview.valid_records} Valid Records`}
            </button>
          </div>
        </div>
      )}

      {/* PHASE 3: ACTIVE BULK PROCESSING */}
      {phase === 'processing' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-8 space-y-6 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="h-14 w-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Processing Bulk Import</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                Parsing batches, validating constraints, and executing transactional records...
              </p>
            </div>

            {/* Live Progress Bar */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-400">Progress</span>
                <span className="text-indigo-600 dark:text-indigo-400">{liveStatus?.progress_percentage || 0}%</span>
              </div>
              <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(5, liveStatus?.progress_percentage || 0)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>{liveStatus?.processed_records || 0} / {liveStatus?.total_records || preview?.total_records || 0} records processed</span>
                <span>Success: {liveStatus?.successful_records || 0} • Failed: {liveStatus?.failed_records || 0}</span>
              </div>
            </div>

            <div className="pt-4 flex justify-center">
              <button
                type="button"
                onClick={handleCancelActiveImport}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
              >
                <StopIcon style={{ fontSize: 16 }} />
                Cancel Import Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 4: FINAL SUMMARY RESULT */}
      {phase === 'result' && result && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              {result.status === 'COMPLETED' ? (
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <CheckCircleIcon style={{ fontSize: 28 }} />
                </div>
              ) : result.status === 'COMPLETED_WITH_ERRORS' ? (
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                  <WarningIcon style={{ fontSize: 28 }} />
                </div>
              ) : result.status === 'CANCELLED' ? (
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <StopIcon style={{ fontSize: 28 }} />
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                  <ErrorIcon style={{ fontSize: 28 }} />
                </div>
              )}
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Import Summary: {result.status.replace(/_/g, ' ')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  File: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{result.filename}</span> • Duration:{' '}
                  <span className="font-bold text-indigo-600">{result.duration_seconds != null ? `${result.duration_seconds.toFixed(2)}s` : 'Completed'}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-500/20"
            >
              Start New Import
            </button>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Records</span>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{result.total_records}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Successful</span>
              <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">{result.successful_records}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">Failed</span>
              <p className="text-xl font-extrabold text-rose-700 dark:text-rose-300 mt-0.5">{result.failed_records}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50">
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wide">Skipped</span>
              <p className="text-xl font-extrabold text-sky-700 dark:text-sky-300 mt-0.5">{result.skipped_records || 0}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Duplicates</span>
              <p className="text-xl font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">{result.duplicate_records}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50">
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Duration</span>
              <p className="text-xl font-extrabold text-purple-700 dark:text-purple-300 mt-0.5">
                {result.duration_seconds != null ? `${result.duration_seconds.toFixed(1)}s` : '-'}
              </p>
            </div>
          </div>

          {/* Data Quality & Reconciliation Integration Banner */}
          {result.reconciliation_run ? (
            result.reconciliation_run.issues_detected > 0 ? (
              <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/50 flex items-start gap-3">
                <ShieldIcon className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" style={{ fontSize: 20 }} />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-amber-950 dark:text-amber-200">
                    Reconciliation Alert: {result.reconciliation_run.issues_detected} Data Quality Discrepancies Detected
                  </p>
                  <p className="text-amber-800 dark:text-amber-300 font-medium">
                    Post-import reconciliation evaluated {result.reconciliation_run.records_checked} records and found {result.reconciliation_run.issues_detected} potential data anomalies. Review the reconciliation log to resolve conflicts.
                  </p>
                  <Link
                    to="/data-quality"
                    className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400 hover:underline pt-0.5"
                  >
                    Resolve Discrepancies in Data Quality Dashboard →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/50 flex items-start gap-3">
                <ShieldIcon className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" style={{ fontSize: 20 }} />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-emerald-950 dark:text-emerald-200">
                    Reconciliation Clean: 0 Data Quality Issues
                  </p>
                  <p className="text-emerald-800 dark:text-emerald-300 font-medium">
                    Automatic reconciliation completed across {result.reconciliation_run.records_checked} records with zero discrepancies. All stock movements, balances, and relational constraints are consistent.
                  </p>
                  <Link
                    to="/data-quality"
                    className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 hover:underline pt-0.5"
                  >
                    View Reconciliation Runs & Metrics →
                  </Link>
                </div>
              </div>
            )
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-2">
                <ShieldIcon className="text-slate-400" style={{ fontSize: 18 }} />
                Post-import reconciliation was not triggered for this job.
              </span>
              <Link to="/data-quality" className="font-semibold text-primary hover:underline">
                Open Data Quality →
              </Link>
            </div>
          )}

          {/* Failed Records list and Download Error CSV */}
          {result.errors.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ErrorIcon style={{ fontSize: 16 }} />
                  Failed Records & Errors ({result.errors.length})
                </h3>
                <button
                  type="button"
                  onClick={() => downloadErrorReport(result.import_id, `errors-${result.filename}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
                >
                  <DownloadIcon style={{ fontSize: 14 }} />
                  Download Error CSV
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <tr className="text-left font-bold text-[10px] uppercase">
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Field</th>
                      <th className="px-3 py-2">Error Type</th>
                      <th className="px-3 py-2">Message</th>
                      <th className="px-3 py-2">Raw Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {result.errors.map((err, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-mono font-bold text-rose-600 dark:text-rose-400">{err.row_number}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">{err.field || '-'}</td>
                        <td className="px-3 py-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {err.error_type || 'VALIDATION_ERROR'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-rose-700 dark:text-rose-300">{err.error_message}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500 truncate max-w-xs">{err.raw_data || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-3">
              <CheckCircleIcon className="text-emerald-600 dark:text-emerald-400" />
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                Zero processing errors! All valid records have been committed to the database.
              </p>
            </div>
          )}
        </div>
      )}

      {/* IMPORT HISTORY TABLE SECTION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <HistoryIcon className="text-indigo-600 dark:text-indigo-400" style={{ fontSize: 20 }} />
              Import History & Audit Log
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Complete historical record of uploads, row counts, durations, and status reports.
            </p>
          </div>

          {/* History Controls / Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-2.5 text-slate-400" style={{ fontSize: 16 }} />
              <input
                type="text"
                placeholder="Search history..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
            <select
              value={historyFilterType}
              onChange={(e) => setHistoryFilterType(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
            >
              <option value="ALL">All Entity Types</option>
              <option value="PRODUCTS">Products</option>
              <option value="INVENTORY">Inventory</option>
              <option value="CUSTOMERS">Customers</option>
              <option value="SALES">Sales</option>
            </select>
            <select
              value={historyFilterStatus}
              onChange={(e) => setHistoryFilterStatus(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="COMPLETED_WITH_ERRORS">Completed with Errors</option>
              <option value="FAILED">Failed</option>
              <option value="PROCESSING">Processing</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button
              type="button"
              onClick={() => refetchHistory()}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              title="Refresh"
            >
              <RefreshIcon style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        {/* History Table */}
        {historyLoading ? (
          <div className="flex h-44 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-44 text-center">
            <HistoryIcon className="text-slate-300 dark:text-slate-700" style={{ fontSize: 40 }} />
            <p className="mt-2 text-xs font-bold text-slate-600 dark:text-slate-400">No import records found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Upload a CSV dataset above to start importing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr className="text-left font-bold text-[10px] uppercase tracking-wider">
                  <th className="px-4 py-3">Import ID</th>
                  <th className="px-4 py-3">Entity Type</th>
                  <th className="px-4 py-3">File Name</th>
                  <th className="px-4 py-3">Uploaded By</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Success</th>
                  <th className="px-4 py-3 text-right">Failed</th>
                  <th className="px-4 py-3 text-right">Skipped</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredHistory.map((item) => {
                  const badge = STATUS_BADGES[item.status] || STATUS_BADGES.PENDING;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => handleOpenHistoryDetail(item)}
                    >
                      <td className="px-4 py-3 font-mono text-slate-500">{item.id.slice(0, 8)}...</td>
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">
                          {item.import_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium truncate max-w-[150px]">
                        {item.filename}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {item.uploaded_by_name || 'Admin'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-200">{item.total_records}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{item.successful_records}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-400">{item.failed_records}</td>
                      <td className="px-4 py-3 text-right font-bold text-sky-600 dark:text-sky-400">{item.skipped_records || 0}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {item.duration_seconds != null ? `${item.duration_seconds.toFixed(1)}s` : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenHistoryDetail(item)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-100 transition-colors"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL / DRAWER */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <TableIcon style={{ fontSize: 22 }} />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Import Execution Details
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    ID: {selectedHistoryItem.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoryItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <CloseIcon style={{ fontSize: 20 }} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Entity Type</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedHistoryItem.import_type}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Filename</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">{selectedHistoryItem.filename}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Duration</span>
                  <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {selectedHistoryItem.duration_seconds != null ? `${selectedHistoryItem.duration_seconds.toFixed(2)}s` : '-'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Strategy</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedHistoryItem.duplicate_strategy || 'REJECT'}</p>
                </div>
              </div>

              {/* Counts */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total</span>
                  <p className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">{selectedHistoryItem.total_records}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Success</span>
                  <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">{selectedHistoryItem.successful_records}</p>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50">
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Failed</span>
                  <p className="text-lg font-extrabold text-rose-700 dark:text-rose-300 mt-0.5">{selectedHistoryItem.failed_records}</p>
                </div>
                <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50">
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase">Skipped</span>
                  <p className="text-lg font-extrabold text-sky-700 dark:text-sky-300 mt-0.5">{selectedHistoryItem.skipped_records || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Duplicates</span>
                  <p className="text-lg font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">{selectedHistoryItem.duplicate_records}</p>
                </div>
              </div>

              {/* Errors list */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    Error Log & Validation Failures ({historyErrors.length})
                  </h4>
                  {historyErrors.length > 0 && (
                    <button
                      type="button"
                      onClick={() => downloadErrorReport(selectedHistoryItem.id, `errors-${selectedHistoryItem.filename}`)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors"
                    >
                      <DownloadIcon style={{ fontSize: 14 }} />
                      Download Error CSV
                    </button>
                  )}
                </div>

                {isLoadingHistoryDetail ? (
                  <div className="flex h-28 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                  </div>
                ) : historyErrors.length === 0 ? (
                  <p className="text-slate-400 text-xs italic p-4 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                    No errors reported for this import run.
                  </p>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        <tr className="text-left font-bold text-[10px] uppercase">
                          <th className="px-3 py-2">Row</th>
                          <th className="px-3 py-2">Field</th>
                          <th className="px-3 py-2">Error Type</th>
                          <th className="px-3 py-2">Message</th>
                          <th className="px-3 py-2">Raw Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {historyErrors.map((err, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="px-3 py-2 font-mono font-bold text-rose-600 dark:text-rose-400">{err.row_number}</td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">{err.field || '-'}</td>
                            <td className="px-3 py-2">
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {err.error_type || 'VALIDATION_ERROR'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-rose-700 dark:text-rose-300">{err.error_message}</td>
                            <td className="px-3 py-2 font-mono text-[11px] text-slate-500 truncate max-w-xs">{err.raw_data || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedHistoryItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataImport;
