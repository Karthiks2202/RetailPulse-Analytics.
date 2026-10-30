import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import {
  getDataQualityIssues,
  updateDataQualityIssueStatus,
  type DataQualityIssue,
  type DataQualityIssueSeverity,
  type DataQualityIssueStatus,
  type DataQualityIssueType,
} from '../../api/dataQualityApi';
import { useAuth } from '../../context/AuthContext';

const ISSUE_TYPE_LABELS: Record<DataQualityIssueType, string> = {
  sale_exceeds_stock: 'Sale Exceeds Stock',
  inventory_inconsistent_with_movements: 'Inventory Inconsistent',
  sale_references_inactive_product: 'Sale References Inactive Product',
  sale_references_invalid_customer: 'Sale References Invalid Customer',
  duplicate_product_sku: 'Duplicate Product SKU',
  missing_mandatory_product_info: 'Missing Product Info',
  missing_mandatory_customer_info: 'Missing Customer Info',
  stock_movement_inconsistent_quantities: 'Stock Movement Inconsistent',
  report_total_mismatch: 'Report Total Mismatch',
};

export const DataQualityIssues: React.FC = () => {
  const { user } = useAuth();
  const isAdmin =
    user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'ANALYST';
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filterStatus, setFilterStatus] = useState<DataQualityIssueStatus | ''>('');
  const [filterSeverity, setFilterSeverity] = useState<DataQualityIssueSeverity | ''>('');
  const [filterModule, setFilterModule] = useState<string>('');
  const [filterIssueType, setFilterIssueType] = useState<DataQualityIssueType | ''>('');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  const [selectedIssue, setSelectedIssue] = useState<DataQualityIssue | null>(null);
  const [newStatus, setNewStatus] = useState<DataQualityIssueStatus>('open');
  const [resolutionNote, setResolutionNote] = useState<string>('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dataQualityIssues', page, pageSize, filterStatus, filterSeverity, filterModule, filterIssueType, filterSearch, filterDateFrom, filterDateTo],
    queryFn: () =>
      getDataQualityIssues({
        page,
        page_size: pageSize,
        status: filterStatus || undefined,
        severity: filterSeverity || undefined,
        module: filterModule || undefined,
        issue_type: filterIssueType || undefined,
        search: filterSearch || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
      }),
    enabled: !!isAdmin,
  });

  const updateStatusMutation = useMutation({
    mutationFn: () =>
      updateDataQualityIssueStatus(selectedIssue!.id, {
        status: newStatus,
        resolution_note: resolutionNote || undefined,
        resolved_by: user?.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataQualityIssues'] });
      queryClient.invalidateQueries({ queryKey: ['dataQualityDashboard'] });
      setSelectedIssue(null);
    },
  });

  const handleOpenResolve = (e: React.MouseEvent, issue: DataQualityIssue) => {
    e.stopPropagation();
    setSelectedIssue(issue);
    setNewStatus(issue.status);
    setResolutionNote(issue.resolution_note || '');
  };

  const handleClearFilters = () => {
    setFilterSearch('');
    setFilterStatus('');
    setFilterSeverity('');
    setFilterModule('');
    setFilterIssueType('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  };

  const getSeverityBadge = (severity: DataQualityIssueSeverity) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900/50';
      case 'medium':
        return 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/50';
      case 'low':
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getStatusBadge = (status: DataQualityIssueStatus) => {
    switch (status) {
      case 'open':
        return 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/50';
      case 'investigating':
        return 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900/50';
      case 'resolved':
        return 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50';
      case 'ignored':
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <Link to="/data-quality" className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1">
              <ArrowBackIcon fontSize="inherit" /> Data Quality
            </Link>
            <span>/</span>
            <span>Issues</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Data Quality Issues
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review, investigate, and resolve data anomalies across your retail modules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-colors"
          >
            <RefreshIcon fontSize="small" className={isFetching ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search description..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <SearchIcon className="absolute left-2.5 top-2.5 text-slate-400" fontSize="small" />
          </div>

          {/* Issue Type Select */}
          <div>
            <select
              value={filterIssueType}
              onChange={(e) => setFilterIssueType(e.target.value as DataQualityIssueType)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Issue Types</option>
              {Object.entries(ISSUE_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Status Select */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as DataQualityIssueStatus)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="ignored">Ignored</option>
            </select>
          </div>

          {/* Severity Select */}
          <div>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as DataQualityIssueSeverity)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Module Select */}
          <div>
            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Modules</option>
              <option value="sales">Sales</option>
              <option value="inventory">Inventory</option>
              <option value="products">Products</option>
              <option value="customers">Customers</option>
              <option value="reports">Reports</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full px-2 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <span className="text-xs text-slate-400">-</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full px-2 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(1)}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors"
          >
            Apply Filters
          </button>
          <button
            onClick={handleClearFilters}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">Loading issues...</p>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircleIcon className="text-emerald-500 text-4xl mb-2" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Issues Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              There are no data quality issues matching the selected filters. Run reconciliation to discover any new anomalies.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Issue Type</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Detected</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {data.items.map((issue) => (
                  <tr
                    key={issue.id}
                    onClick={() => navigate(`/data-quality/issues/${issue.id}`)}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {issue.id.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {ISSUE_TYPE_LABELS[issue.issue_type] || issue.issue_type}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getSeverityBadge(issue.severity)}`}>
                        {issue.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-medium text-[11px]">
                        {issue.affected_module}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate" title={issue.description}>
                      {issue.description}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadge(issue.status)}`}>
                        {issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {new Date(issue.detected_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => handleOpenResolve(e, issue)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition-colors"
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data && data.total > 0 && (
          <div className="py-3 px-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing {data.items.length} of {data.total} issues
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Previous
              </button>
              <span className="px-2 font-medium">Page {page}</span>
              <button
                disabled={page * pageSize >= data.total}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Status Update Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Update Issue Status
              </h3>
              <button
                onClick={() => setSelectedIssue(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <CloseIcon fontSize="small" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-white mb-1">
                {ISSUE_TYPE_LABELS[selectedIssue.issue_type] || selectedIssue.issue_type}
              </p>
              <p>{selectedIssue.description}</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as DataQualityIssueStatus)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                  <option value="ignored">Ignored</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Resolution Note
                </label>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Explain actions taken to fix or explain this issue..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedIssue(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => updateStatusMutation.mutate()}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm disabled:opacity-50 transition-colors"
              >
                {updateStatusMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataQualityIssues;
