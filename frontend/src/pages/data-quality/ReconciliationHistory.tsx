import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import {
  triggerReconciliation,
  getReconciliationRuns,
  type ReconciliationRunStatus,
} from '../../api/dataQualityApi';
import { useAuth } from '../../context/AuthContext';

export const ReconciliationHistory: React.FC = () => {
  const { user } = useAuth();
  const isAdmin =
    user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'ANALYST';
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [isTriggering, setIsTriggering] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['reconciliationRuns', page, pageSize],
    queryFn: () => getReconciliationRuns({ page, page_size: pageSize }),
    enabled: !!isAdmin,
  });

  const triggerMutation = useMutation({
    mutationFn: () => triggerReconciliation(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['reconciliationRuns'] });
      queryClient.invalidateQueries({ queryKey: ['dataQualityDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dataQualityIssues'] });
      setIsTriggering(false);
      setFeedback(`Reconciliation finished: ${result.records_checked} checked, ${result.issues_detected} anomalies.`);
      setTimeout(() => setFeedback(null), 6000);
    },
    onError: (err: any) => {
      setIsTriggering(false);
      setFeedback(err?.response?.data?.detail || 'Reconciliation failed to execute.');
      setTimeout(() => setFeedback(null), 6000);
    },
  });

  const handleTriggerReconciliation = () => {
    setIsTriggering(true);
    setFeedback(null);
    triggerMutation.mutate();
  };

  const getStatusBadge = (status: ReconciliationRunStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50';
      case 'completed_with_issues':
        return 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/50';
      case 'failed':
        return 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900/50';
      case 'running':
        return 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900/50';
      case 'pending':
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
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
            <span>Reconciliation</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Reconciliation History
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Audit logs of reconciliation runs verifying transactional and inventory records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-colors"
          >
            <RefreshIcon fontSize="small" className={isFetching ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleTriggerReconciliation}
            disabled={isTriggering}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-colors"
          >
            {isTriggering ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Running Checks...</span>
              </>
            ) : (
              <>
                <PlayIcon fontSize="small" />
                <span>Run Reconciliation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-sm flex items-center justify-between shadow-sm animate-fade-in">
          <span>{feedback}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">Loading history...</p>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-12 text-center">
            <HistoryIcon className="text-slate-300 dark:text-slate-600 text-5xl mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Reconciliation Runs Yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto mb-4">
              Trigger your first automated data audit to evaluate stock levels, sales consistency, and product integrity.
            </p>
            <button
              onClick={handleTriggerReconciliation}
              disabled={isTriggering}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors"
            >
              <PlayIcon fontSize="small" />
              <span>Run First Reconciliation</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Run ID</th>
                  <th className="py-3 px-4">Started At</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Records Checked</th>
                  <th className="py-3 px-4">Issues Detected</th>
                  <th className="py-3 px-4">Failed Checks</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {data.items.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {run.id.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadge(run.status)}`}>
                        {run.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {run.records_checked.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-semibold ${run.issues_detected > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {run.issues_detected.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {run.failed_checks}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {run.issues_detected > 0 ? (
                        <Link
                          to="/data-quality/issues"
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition-colors inline-block"
                        >
                          View Issues
                        </Link>
                      ) : (
                        <span className="text-[11px] text-slate-400">All Passed</span>
                      )}
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
              Showing {data.items.length} of {data.total} runs
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
    </div>
  );
};

export default ReconciliationHistory;
