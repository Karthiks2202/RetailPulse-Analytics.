import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  WarningAmber as WarningIcon,
  ErrorOutlined as ErrorIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  History as HistoryIcon,
  AssignmentLate as IssuesIcon,
  TrendingUp as TrendingUpIcon,
  Shield as ShieldIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { getDataQualityDashboard, triggerReconciliation } from '../../api/dataQualityApi';
import { useAuth } from '../../context/AuthContext';

export const DataQualityDashboard: React.FC = () => {
  const { user } = useAuth();
  const isAdmin =
    user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'ANALYST';
  const queryClient = useQueryClient();
  const [isTriggering, setIsTriggering] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['dataQualityDashboard'],
    queryFn: getDataQualityDashboard,
    enabled: !!isAdmin,
  });

  const triggerMutation = useMutation({
    mutationFn: () => triggerReconciliation(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['dataQualityDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliationRuns'] });
      queryClient.invalidateQueries({ queryKey: ['dataQualityIssues'] });
      setIsTriggering(false);
      setRunMessage(
        `Reconciliation completed: ${result.records_checked} checked, ${result.issues_detected} issues detected.`
      );
      setTimeout(() => setRunMessage(null), 6000);
    },
    onError: (err: any) => {
      setIsTriggering(false);
      setRunMessage(err?.response?.data?.detail || 'Failed to trigger reconciliation');
      setTimeout(() => setRunMessage(null), 6000);
    },
  });

  const handleRunReconciliation = () => {
    setIsTriggering(true);
    setRunMessage(null);
    triggerMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading data quality metrics...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400">
          <p className="font-semibold">Error loading dashboard</p>
          <p className="text-sm mt-1">{(error as Error).message}</p>
          <button
            onClick={() => refetch()}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            <RefreshIcon fontSize="small" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const healthScore =
    data && data.total_records_checked > 0
      ? Math.max(0, Math.min(100, Math.round((data.valid_records / data.total_records_checked) * 100)))
      : 100;

  const healthColor =
    healthScore >= 90
      ? 'text-emerald-500'
      : healthScore >= 70
      ? 'text-amber-500'
      : 'text-rose-500';

  const healthBarColor =
    healthScore >= 90
      ? 'bg-emerald-500'
      : healthScore >= 70
      ? 'bg-amber-500'
      : 'bg-rose-500';

  const metricCards = [
    {
      title: 'Total Records Checked',
      value: data?.total_records_checked.toLocaleString() ?? '0',
      desc: data?.last_reconciliation_time
        ? `Last run: ${new Date(data.last_reconciliation_time).toLocaleDateString()} ${new Date(
            data.last_reconciliation_time
          ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Reconciliation has not run yet',
      icon: <AssessmentIcon className="text-white" fontSize="small" />,
      iconBg: 'bg-indigo-500',
      cardBg: 'bg-gradient-to-br from-indigo-50/70 to-white dark:from-indigo-950/20 dark:to-slate-900',
      border: 'border-indigo-100 dark:border-indigo-900/30',
      valueColor: 'text-indigo-700 dark:text-indigo-300',
    },
    {
      title: 'Valid Records',
      value: data?.valid_records.toLocaleString() ?? '0',
      desc: 'Passed all integrity rules',
      icon: <CheckCircleIcon className="text-white" fontSize="small" />,
      iconBg: 'bg-emerald-500',
      cardBg: 'bg-gradient-to-br from-emerald-50/70 to-white dark:from-emerald-950/20 dark:to-slate-900',
      border: 'border-emerald-100 dark:border-emerald-900/30',
      valueColor: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      title: 'Records with Warnings',
      value: data?.records_with_warnings.toLocaleString() ?? '0',
      desc: 'Open issues pending review',
      icon: <WarningIcon className="text-white" fontSize="small" />,
      iconBg: 'bg-amber-500',
      cardBg: 'bg-gradient-to-br from-amber-50/70 to-white dark:from-amber-950/20 dark:to-slate-900',
      border: 'border-amber-100 dark:border-amber-900/30',
      valueColor: 'text-amber-700 dark:text-amber-300',
    },
    {
      title: 'Records with Errors',
      value: data?.records_with_errors.toLocaleString() ?? '0',
      desc: 'Issues actively investigating',
      icon: <ErrorIcon className="text-white" fontSize="small" />,
      iconBg: 'bg-rose-500',
      cardBg: 'bg-gradient-to-br from-rose-50/70 to-white dark:from-rose-950/20 dark:to-slate-900',
      border: 'border-rose-100 dark:border-rose-900/30',
      valueColor: 'text-rose-700 dark:text-rose-300',
    },
    {
      title: 'Unresolved Issues',
      value: data?.unresolved_issues.toLocaleString() ?? '0',
      desc: 'Requiring administrative attention',
      icon: <IssuesIcon className="text-white" fontSize="small" />,
      iconBg: 'bg-orange-500',
      cardBg: 'bg-gradient-to-br from-orange-50/70 to-white dark:from-orange-950/20 dark:to-slate-900',
      border: 'border-orange-100 dark:border-orange-900/30',
      valueColor: 'text-orange-700 dark:text-orange-300',
    },
    {
      title: 'Total Issues Detected',
      value: data?.total_issues.toLocaleString() ?? '0',
      desc: 'Historical anomalies found',
      icon: <TrendingUpIcon className="text-white" fontSize="small" />,
      iconBg: 'bg-purple-500',
      cardBg: 'bg-gradient-to-br from-purple-50/70 to-white dark:from-purple-950/20 dark:to-slate-900',
      border: 'border-purple-100 dark:border-purple-900/30',
      valueColor: 'text-purple-700 dark:text-purple-300',
    },
    {
      title: 'Resolved Issues',
      value: data?.resolved_issues.toLocaleString() ?? '0',
      desc: 'Marked resolved or cleared',
      icon: <ShieldIcon className="text-white" fontSize="small" />,
      iconBg: 'bg-teal-500',
      cardBg: 'bg-gradient-to-br from-teal-50/70 to-white dark:from-teal-950/20 dark:to-slate-900',
      border: 'border-teal-100 dark:border-teal-900/30',
      valueColor: 'text-teal-700 dark:text-teal-300',
    },
    {
      title: 'Data Health Score',
      value: `${healthScore}%`,
      desc: 'Clean & consistent records ratio',
      icon: <CheckCircleIcon className="text-white" fontSize="small" />,
      iconBg: healthScore >= 80 ? 'bg-emerald-500' : 'bg-amber-500',
      cardBg: 'bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/40 dark:to-slate-900',
      border: 'border-slate-200 dark:border-slate-800',
      valueColor: healthColor,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Data Quality Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Audit and monitor consistency across sales, stock movements, products, customers, and reports.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-colors"
            title="Refresh metrics"
          >
            <RefreshIcon fontSize="small" className={isFetching ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <Link
            to="/data-quality/issues"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
          >
            <IssuesIcon fontSize="small" />
            <span>View Issues ({data?.unresolved_issues ?? 0})</span>
          </Link>

          <Link
            to="/data-quality/reconciliation"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-colors"
          >
            <HistoryIcon fontSize="small" />
            <span>History</span>
          </Link>

          <button
            onClick={handleRunReconciliation}
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

      {/* Alert toast notification */}
      {runMessage && (
        <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-sm flex items-center justify-between shadow-sm animate-fade-in">
          <span>{runMessage}</span>
          <button
            onClick={() => setRunMessage(null)}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Health Overview Hero Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
                System Health Summary
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                  healthScore >= 90
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : healthScore >= 70
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                }`}
              >
                {healthScore >= 90 ? 'Healthy' : healthScore >= 70 ? 'Warnings Detected' : 'Needs Review'}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {data && data.total_records_checked > 0
                ? `${data.valid_records.toLocaleString()} of ${data.total_records_checked.toLocaleString()} records validated successfully.`
                : 'No reconciliation audit has been conducted yet. Click "Run Reconciliation" to initiate.'}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium block">Health Score</span>
              <span className={`text-3xl font-extrabold ${healthColor}`}>{healthScore}%</span>
            </div>
            <div className="w-36 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${healthBarColor} transition-all duration-700`}
                style={{ width: `${healthScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 8 Metric KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card, idx) => (
          <div
            key={idx}
            className={`p-5 rounded-2xl border ${card.border} ${card.cardBg} shadow-sm hover:shadow-md transition-all flex flex-col justify-between`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {card.title}
                </p>
                <p className={`text-2xl font-extrabold mt-2 tracking-tight ${card.valueColor}`}>
                  {card.value}
                </p>
              </div>
              <div className={`p-2.5 rounded-xl ${card.iconBg} shadow-sm shrink-0`}>
                {card.icon}
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/50">
              {card.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Action Navigation Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <Link
          to="/data-quality/issues"
          className="group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 shadow-sm transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <IssuesIcon />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Quality Issues Center
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Inspect, filter, update resolution notes, and resolve data anomalies.
              </p>
            </div>
          </div>
          <ArrowForwardIcon className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          to="/data-quality/reconciliation"
          className="group p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 shadow-sm transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <HistoryIcon />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Reconciliation History & Audit
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                View previous check execution logs, records processed, and duration.
              </p>
            </div>
          </div>
          <ArrowForwardIcon className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
        </Link>
      </div>
    </div>
  );
};

export default DataQualityDashboard;
