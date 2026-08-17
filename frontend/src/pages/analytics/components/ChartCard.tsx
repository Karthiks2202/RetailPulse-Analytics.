import React from 'react';

interface ChartCardProps {
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  isEmpty: boolean;
  emptyText: string;
  children: React.ReactNode;
  className?: string;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, icon, loading, isEmpty, emptyText, children, className = '' }) => {
  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden ${className}`}>
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
        {icon}
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="p-4 h-72">
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-lg h-full min-h-[180px]" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
            <div className="text-slate-300 dark:text-slate-700" style={{ fontSize: 36 }} />
            <span className="text-xs font-semibold">{emptyText}</span>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default ChartCard;
