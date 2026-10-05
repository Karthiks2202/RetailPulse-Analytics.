import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Notifications as NotificationsIcon, CheckCircle as CheckIcon, Warning as WarningIcon, Error as ErrorIcon, Close as CloseIcon } from '@mui/icons-material';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead, type Notification, type NotificationType } from '../api/notificationsApi';
import { useAuth } from '../context/AuthContext';

const TYPE_ICON: Record<string, React.ElementType> = {
  LOW_STOCK: WarningIcon,
  OUT_OF_STOCK: ErrorIcon,
  STOCKOUT_RISK: ErrorIcon,
  OVERSTOCK: WarningIcon,
  IMPORT_FAILED: ErrorIcon,
  IMPORT_COMPLETED: CheckIcon,
  IMPORT_COMPLETED_WITH_ERRORS: WarningIcon,
  SALES_ALERT: NotificationsIcon,
  SYSTEM_ALERT: NotificationsIcon,
};

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: getUnreadCount,
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => getNotifications({ limit: 10 }),
    enabled: !!user && open,
  });

  const markReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifications: Notification[] = notificationsData?.data || [];

  const getIcon = (type: string) => {
    const Icon = TYPE_ICON[type] || NotificationsIcon;
    const colorClass: Record<string, string> = {
      OUT_OF_STOCK: 'text-red-500',
      STOCKOUT_RISK: 'text-red-500',
      IMPORT_FAILED: 'text-red-500',
      LOW_STOCK: 'text-amber-500',
      OVERSTOCK: 'text-blue-500',
      IMPORT_COMPLETED: 'text-emerald-500',
      IMPORT_COMPLETED_WITH_ERRORS: 'text-amber-500',
      SALES_ALERT: 'text-indigo-500',
      SYSTEM_ALERT: 'text-slate-500',
    };
    return <Icon className={colorClass[type] || 'text-indigo-500'} fontSize="small" />;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'text-red-600 dark:text-red-400';
      case 'HIGH': return 'text-orange-600 dark:text-orange-400';
      case 'MEDIUM': return 'text-amber-600 dark:text-amber-400';
      default: return 'text-slate-400 dark:text-slate-500';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 transition-all bg-white dark:bg-slate-900 shadow-sm"
      >
        <NotificationsIcon style={{ fontSize: 20 }} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <CloseIcon style={{ fontSize: 16 }} />
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <NotificationsIcon className="mx-auto text-slate-300 dark:text-slate-600 mb-2" style={{ fontSize: 32 }} />
                <p className="text-xs text-slate-500 dark:text-slate-400">No notifications</p>
              </div>
            ) : (
              notifications.map((notif: Notification) => (
                <div
                  key={notif.id}
                  className={`flex gap-3 p-3 border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                    !notif.is_read ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{getIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-xs truncate ${!notif.is_read ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                        {notif.title}
                      </p>
                      <span className={`shrink-0 text-[9px] font-bold ${getPriorityColor(notif.priority)}`}>
                        {notif.priority}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-2">
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      {formatDate(notif.created_at)}
                    </p>
                  </div>
                  {!notif.is_read && (
                    <button
                      onClick={() => markReadMutation.mutate(notif.id)}
                      className="shrink-0 p-1 rounded-full text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors self-center"
                      title="Mark as read"
                    >
                      <CheckIcon style={{ fontSize: 14 }} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-center">
            <a href="/notifications" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300">
              View all notifications
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
