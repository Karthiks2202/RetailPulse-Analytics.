import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  getAuditLogs,
  exportAuditLogsCsv,
  exportAuditLogsPdf,
  clearAuditLogs,
  type AuditLog,
} from '../../api/auditLogApi';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  FilterList as FilterIcon,
  ClearAll as ClearIcon,
} from '@mui/icons-material';
import { Pagination } from '../../components/Pagination';

const ACTION_OPTIONS = [
  'Company Registered',
  'User Login',
  'User Logout',
  'Product Created',
  'Product Updated',
  'Product Deleted',
  'Product Activated',
  'Product Deactivated',
  'Customer Created',
  'Customer Updated',
  'Customer Deleted',
  'Customer Activated',
  'Customer Deactivated',
  'Stock Added',
  'Stock Removed',
  'Stock Adjusted',
  'Reorder Level Updated',
  'Import Uploaded',
  'Sales Exported',
  'Customer Exported',
  'Forecast Exported',
  'Audit Logs Exported',
  'Audit Logs Cleared',
  'Password Changed',
];

const RESOURCE_TYPE_OPTIONS = [
  'Product',
  'Customer',
  'Category',
  'Sale',
  'Inventory',
  'Import',
  'Forecast',
  'AuditLog',
  'User',
  'Company',
];

const STATUS_OPTIONS = ['SUCCESS', 'FAILURE', 'PENDING'];

const inputClass =
  'bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none transition-all';

export const AuditLogs: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearConfirm, setClearConfirm] = useState('');
  const [clearBeforeDate, setClearBeforeDate] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-logs', { search, actionFilter, resourceTypeFilter, statusFilter, dateFrom, dateTo, sortBy, sortDir, page, limit }],
    queryFn: () =>
      getAuditLogs({
        search: search || undefined,
        action: actionFilter || undefined,
        resource_type: resourceTypeFilter || undefined,
        status: statusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
        page,
        limit,
      }),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const exportCsvMutation = useMutation({
    mutationFn: (params: any) => exportAuditLogsCsv(params),
    onSuccess: (blob: Blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit_logs.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showNotification('Audit logs exported as CSV', 'success');
    },
    onError: () => {
      showNotification('Failed to export audit logs', 'error');
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: (params: any) => exportAuditLogsPdf(params),
    onSuccess: (blob: Blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit_logs.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showNotification('Audit logs exported as PDF', 'success');
    },
    onError: () => {
      showNotification('Failed to export audit logs', 'error');
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => clearAuditLogs(clearBeforeDate || undefined, true),
    onSuccess: (result: { message: string; deleted_count: number }) => {
      showNotification(result.message, 'success');
      setShowClearModal(false);
      setClearConfirm('');
      setClearBeforeDate('');
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
    onError: (err: any) => {
      showNotification(err?.response?.data?.error || 'Failed to clear audit logs', 'error');
    },
  });

  const resetFilters = () => {
    setSearch('');
    setActionFilter('');
    setResourceTypeFilter('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handleExportCsv = () => {
    exportCsvMutation.mutate({
      action: actionFilter || undefined,
      resource_type: resourceTypeFilter || undefined,
      status: statusFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: search || undefined,
    });
  };

  const handleExportPdf = () => {
    exportPdfMutation.mutate({
      action: actionFilter || undefined,
      resource_type: resourceTypeFilter || undefined,
      status: statusFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: search || undefined,
    });
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString();
  };

  const formatJson = (val: Record<string, any> | null) => {
    if (!val) return '—';
    return JSON.stringify(val, null, 2);
  };

  const activeFiltersCount = [actionFilter, resourceTypeFilter, statusFilter, dateFrom, dateTo].filter(Boolean).length;

  if (!isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-600 font-medium">You do not have permission to view audit logs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Audit Logs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Track and review important actions across your organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
              showFilters || activeFiltersCount > 0
                ? 'border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <FilterIcon style={{ fontSize: 16 }} />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-1 h-4 w-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
          <button
            onClick={handleExportCsv}
            disabled={exportCsvMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-60"
          >
            <DownloadIcon style={{ fontSize: 16 }} />
            CSV
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exportPdfMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-60"
          >
            <DownloadIcon style={{ fontSize: 16 }} />
            PDF
          </button>
          <button
            onClick={() => setShowClearModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
          >
            <ClearIcon style={{ fontSize: 16 }} />
            Clear Logs
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Action</label>
              <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className={inputClass}>
                <option value="">All Actions</option>
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Resource Type</label>
              <select value={resourceTypeFilter} onChange={(e) => { setResourceTypeFilter(e.target.value); setPage(1); }} className={inputClass}>
                <option value="">All Resources</option>
                {RESOURCE_TYPE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Status</label>
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={inputClass}>
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Date From</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Date To</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className={inputClass} />
            </div>
            <div className="flex items-end">
              <button onClick={resetFilters} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center gap-3 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: 18 }} />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by action, resource, description, IP..."
              className={`w-full ${inputClass} pl-10`}
            />
          </div>
          <select value={`${sortBy}-${sortDir}`} onChange={(e) => { const [s, d] = e.target.value.split('-'); setSortBy(s); setSortDir(d as any); setPage(1); }} className={`${inputClass} lg:w-48`}>
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="action-asc">Action (A-Z)</option>
            <option value="resource_type-asc">Resource (A-Z)</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          </div>
        ) : isError ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-red-600 font-medium">Failed to load audit logs.</p>
          </div>
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-6">
            <FilterIcon className="text-slate-300 dark:text-slate-700" style={{ fontSize: 48 }} />
            <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-400">No activity found</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No audit logs match the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-3 font-bold">Timestamp</th>
                  <th className="px-6 py-3 font-bold">User</th>
                  <th className="px-6 py-3 font-bold">Action</th>
                  <th className="px-6 py-3 font-bold">Resource</th>
                  <th className="px-6 py-3 font-bold">Description</th>
                  <th className="px-6 py-3 font-bold">IP Address</th>
                  <th className="px-6 py-3 font-bold">Status</th>
                  <th className="px-6 py-3 font-bold text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((log) => (
                  <tr key={log.id} className="group border-b border-slate-100 dark:border-slate-800/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10 transition-colors">
                    <td className="px-6 py-3.5 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                      {formatTimestamp(log.created_at)}
                    </td>
                    <td className="px-6 py-3.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {log.user_name || '—'}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{log.action}</span>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                      {log.resource_type || '—'}
                      {log.resource_id && <span className="ml-1 text-[10px] text-slate-400 font-mono">{log.resource_id.slice(0, 8)}…</span>}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-600 dark:text-slate-300 max-w-[260px] truncate">
                      {log.description || '—'}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-600 dark:text-slate-300 font-mono">
                      {log.ip_address}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold capitalize tracking-wide ${
                        log.status === 'SUCCESS'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30'
                          : log.status === 'FAILURE'
                          ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30'
                          : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30'
                      }`}>
                        {log.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
                        title="View Details"
                      >
                        <ViewIcon style={{ fontSize: 16 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > 0 && (
          <div className="px-6">
            <Pagination page={page} pageSize={limit} total={data.total} onPageChange={setPage} />
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-modal-enter">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Audit Log Details</h2>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <CloseIcon style={{ fontSize: 20 }} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">User</label>
                  <p className="text-sm text-slate-800 dark:text-slate-100 font-medium">{selectedLog.user_name || '—'}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Action</label>
                  <p className="text-sm text-slate-800 dark:text-slate-100 font-medium">{selectedLog.action}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Resource Type</label>
                  <p className="text-sm text-slate-800 dark:text-slate-100 font-medium">{selectedLog.resource_type || '—'}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Resource ID</label>
                  <p className="text-sm text-slate-800 dark:text-slate-100 font-mono">{selectedLog.resource_id || '—'}</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Description</label>
                  <p className="text-sm text-slate-800 dark:text-slate-100">{selectedLog.description || '—'}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Timestamp</label>
                  <p className="text-sm text-slate-800 dark:text-slate-100 font-medium">{formatTimestamp(selectedLog.created_at)}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Status</label>
                  <p className="text-sm text-slate-800 dark:text-slate-100 font-medium">{selectedLog.status}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">IP Address</label>
                  <p className="text-sm text-slate-800 dark:text-slate-100 font-mono">{selectedLog.ip_address}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">User Agent</label>
                  <p className="text-sm text-slate-800 dark:text-slate-100 break-all">{selectedLog.user_agent}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Before Values</label>
                  <pre className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {formatJson(selectedLog.before_values)}
                  </pre>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">After Values</label>
                  <pre className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {formatJson(selectedLog.after_values)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl animate-modal-enter">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Clear Audit Logs</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400 text-sm font-medium">
                This action will permanently delete audit logs. This operation cannot be undone.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Clear logs before date (optional)</label>
                <input type="date" value={clearBeforeDate} onChange={(e) => setClearBeforeDate(e.target.value)} className={inputClass} />
                <p className="text-[10px] text-slate-400 mt-1">Leave empty to clear all logs.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Type "CLEAR" to confirm</label>
                <input
                  type="text"
                  value={clearConfirm}
                  onChange={(e) => setClearConfirm(e.target.value)}
                  placeholder='Enter "CLEAR"'
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setShowClearModal(false); setClearConfirm(''); setClearBeforeDate(''); }}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => clearMutation.mutate()}
                  disabled={clearConfirm !== 'CLEAR' || clearMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-500/10 transition-all disabled:opacity-60"
                >
                  {clearMutation.isPending ? 'CLEARING...' : 'Clear Logs'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
