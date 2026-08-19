import React from 'react';
import { ChevronRight as ChevronRightIcon } from '@mui/icons-material';

export interface KPIItem {
  id: string;
  title: string;
  value: string;
  icon: React.ReactNode;
  color: {
    bg: string;
    darkBg: string;
    border: string;
    accent: string;
    text: string;
    sub: string;
  };
  drillType: 'transactions' | 'products' | 'low_stock' | 'out_of_stock' | 'categories';
}

interface KPICardProps {
  item: KPIItem;
  onClick: (drillType: KPIItem['drillType']) => void;
}

const KPICard: React.FC<KPICardProps> = ({ item, onClick }) => {
  return (
    <div
      onClick={() => onClick(item.drillType)}
      className={`relative overflow-hidden rounded-2xl p-4 md:p-5 border shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group bg-gradient-to-br ${item.color.bg} ${item.color.darkBg} ${item.color.border}`}
    >
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${item.color.accent}`} />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] md:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-tight">{item.title}</span>
        <div className={`h-8 w-8 md:h-9 md:w-9 rounded-xl flex items-center justify-center shadow-md shrink-0 transition-transform group-hover:scale-110 ${item.color.accent}`}>
          {item.icon}
        </div>
      </div>
      <div className={`text-2xl md:text-3xl font-extrabold tracking-tight mb-1 ${item.color.text}`}>{item.value}</div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span>Click to drill down</span>
        <ChevronRightIcon style={{ fontSize: 14 }} className="group-hover:translate-x-1 transition-transform text-indigo-500" />
      </div>
    </div>
  );
};

export default KPICard;
