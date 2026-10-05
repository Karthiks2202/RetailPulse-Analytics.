import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Notifications as NotificationsIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  Close as CloseIcon,
  Inventory as InventoryIcon,
  CloudUpload as ImportIcon,
  ShoppingCart as SaleIcon,
  Settings as SystemIcon,
  Launch as LaunchIcon,
} from '@mui/icons-material';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotification,
  type Notification,
  type NotificationType,
  type NotificationPriority,
  type NotificationResourceType,
} from '../../api/notificationsApi';
import { getProductRecommendation } from '../../api/inventoryApi';
import { getImportDetail } from '../../api/importApi';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  STOCKOUT_RISK: { label: 'Stockout Risk', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', Icon: ErrorIcon },
  LOW_STOCK: { label: 'Low Stock', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', Icon: WarningIcon },
  OUT_OF_STOCK: { label: 'Out of Stock', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-950/30', Icon: ErrorIcon },
  OVERSTOCK: { label: 'Overstock', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', Icon: InfoIcon },
  IMPORT_COMPLETED: { label: 'Import Completed', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', Icon: CheckIcon },
  IMPORT_FAILED: { label: 'Import Failed', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', Icon: ErrorIcon },
  IMPORT_COMPLETED_WITH_ERRORS: { label: 'Import (with errors)', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', Icon: WarningIcon },
  SALES_ALERT: { label: 'Sales Alert', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30', Icon: NotificationsIcon },
  SYSTEM_ALERT: { label: 'System Alert', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800/50', Icon: SystemIcon },
  CUSTOMER_REGISTERED: { label: 'Customer Registered', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30', Icon: InfoIcon },
  VIP_STATUS: { label: 'VIP Status', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', Icon: InfoIcon },
  CUSTOMER_INACTIVE: { label: 'Customer Inactive', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800/50', Icon: InfoIcon },
  FIRST_PURCHASE: { label: 'First Purchase', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', Icon: CheckIcon },
};

const PRIORITY_CONFIG: Record<NotificationPriority, { label: string; dot: string }> = {
  CRITICAL: { label: 'Critical', dot: 'bg-red-500' },
  HIGH: { label: 'High', dot: 'bg-orange-500' },
  MEDIUM: { label: 'Medium', dot: 'bg-amber-500' },
  LOW: { label: 'Low', dot: 'bg-slate-400' },
};

const RESOURCE_ICON: Record<string, React.ElementType> = {
  PRODUCT: InventoryIcon,
  IMPORT: ImportIcon,
  SALE: SaleIcon,
  SYSTEM: SystemIcon,
  INVENTORY: InventoryIcon,
};

const NOTIFICATION_TYPES: NotificationType[] = [
  'STOCKOUT_RISK', 'LOW_STOCK', 'OUT_OF_STOCK', 'OVERSTOCK',
  'IMPORT_COMPLETED', 'IMPORT_FAILED', 'IMPORT_COMPLETED_WITH_ERRORS',
  'SALES_ALERT', 'SYSTEM_ALERT', 'CUSTOMER_REGISTERED', 'VIP_STATUS',
  'CUSTOMER_INACTIVE', 'FIRST_PURCHASE',
];

const NOTIFICATION_PRIORITIES: NotificationPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedType, setSelectedType] = useState<NotificationType | ''>('');
  const [selectedPriority, setSelectedPriority] = useState<NotificationPriority | ''>('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const { data: unreadCountData } = useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: getUnreadCount,
    refetchInterval: 30000,
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['notification', 'detail', selectedNotification?.id],
    queryFn: async () => {
      if (!selectedNotification) return null;
      const [notif, productRec] = await Promise.all([
        getNotification(selectedNotification.id),
        selectedNotification.resource_type === 'PRODUCT' && selectedNotification.resource_id
          ? getProductRecommendation(selectedNotification.resource_id).catch(() => null)
          : Promise.resolve(null),
      ]);
      return { notif, productRec };
    },
    enabled: !!selectedNotification,
  });

  const { data: importDetail } = useQuery({
    queryKey: ['import', 'detail', selectedNotification?.resource_id],
    queryFn: async () => {
      if (!selectedNotification || selectedNotification.resource_type !== 'IMPORT' || !selectedNotification.resource_id) return null;
      return getImportDetail(selectedNotification.resource_id);
    },
    enabled: !!selectedNotification && selectedNotification.resource_type === 'IMPORT',
  });

  const filters = useMemo(() => {
    const params: { type?: string; priority?: string; is_read?: boolean; skip: number; limit: number } = {
      skip: page * 20,
      limit: 20,
    };
    if (filterTab === 'unread') params.is_read = false;
    if (filterTab === 'read') params.is_read = true;
    if (selectedType) params.type = selectedType;
    if (selectedPriority) params.priority = selectedPriority;
    return params;
  }, [filterTab, selectedType, selectedPriority, page]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['notifications', 'list', filters],
    queryFn: () => getNotifications(filters),
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

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setSelectedNotification(null);
    },
  });

  const notifications: Notification[] = data?.data || [];
  const total = data?.total || 0;
  const unreadCount = unreadCountData?.unread_count || 0;

  const handleClearFilters = () => {
    setFilterTab('all');
    setSelectedType('');
    setSelectedPriority('');
    setPage(0);
  };

  const hasActiveFilters = filterTab !== 'all' || selectedType !== '' || selectedPriority !== '';

  const getResourceLink = (n: Notification) => {
    if (!n.resource_type || !n.resource_id) return null;
    const links: Record<string, string> = {
      PRODUCT: `/products?id=${n.resource_id}`,
      IMPORT: `/data-import`,
      SALE: `/sales`,
      INVENTORY: `/inventory`,
      SYSTEM: '#',
    };
    return links[n.resource_type] || '#';
  };

  const handleNotificationClick = async (notif: Notification) => {
    setSelectedNotification(notif);
    if (!notif.is_read) {
      markReadMutation.mutate(notif.id);
    }
  };

  const handleViewResource = () => {
    if (!selectedNotification) return;
    const link = getResourceLink(selectedNotification);
    if (link && link !== '#') {
      navigate(link);
      setSelectedNotification(null);
    }
  };

  const detailNotif = detailData?.notif || selectedNotification;
  const productRec = detailData?.productRec;
  const isProductNotification = selectedNotification?.resource_type === 'PRODUCT';
  const isImportNotification = selectedNotification?.resource_type === 'IMPORT';

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Notifications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'You\'re all caught up'}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
            >
              <CheckIcon style={{ fontSize: 14 }} />
              Mark all as read
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border text-xs font-bold transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <FilterIcon style={{ fontSize: 14 }} />
            Filters
            {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-indigo-500" />}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl mb-4">
        {(['all', 'unread', 'read'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setFilterTab(tab); setPage(0); }}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
              filterTab === tab
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab}
            {tab === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[10px]">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Expandable Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Type</label>
              <select
                value={selectedType}
                onChange={(e) => { setSelectedType(e.target.value as NotificationType | ''); setPage(0); }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              >
                <option value="">All Types</option>
                {NOTIFICATION_TYPES.map((t) => (
                  <option key={t} value={t}>{NOTIFICATION_TYPE_CONFIG[t]?.label || t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Priority</label>
              <select
                value={selectedPriority}
                onChange={(e) => { setSelectedPriority(e.target.value as NotificationPriority | ''); setPage(0); }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              >
                <option value="">All Priorities</option>
                {NOTIFICATION_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p]?.label || p}</option>
                ))}
              </select>
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-800 dark:hover:text-indigo-300"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Notifications List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-6 text-center">
          <ErrorIcon className="mx-auto text-red-400 mb-2" style={{ fontSize: 40 }} />
          <p className="text-sm font-bold text-red-700 dark:text-red-300">Failed to load notifications</p>
          <button onClick={() => refetch()} className="mt-3 text-xs text-red-600 dark:text-red-400 font-bold underline">
            Retry
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <NotificationsIcon className="mx-auto text-slate-300 dark:text-slate-600 mb-3" style={{ fontSize: 48 }} />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No notifications found</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {hasActiveFilters ? 'Try adjusting your filters' : 'You\'re all caught up. No new notifications.'}
          </p>
          {hasActiveFilters && (
            <button onClick={handleClearFilters} className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 font-bold">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const typeConfig = NOTIFICATION_TYPE_CONFIG[notif.type] || { label: notif.type, color: 'text-slate-600', bg: 'bg-slate-100', Icon: NotificationsIcon };
            const priorityConfig = PRIORITY_CONFIG[notif.priority] || { label: notif.priority, dot: 'bg-slate-400' };
            const ResourceIcon = RESOURCE_ICON[notif.resource_type || 'SYSTEM'] || SystemIcon;
            const resourceLink = getResourceLink(notif);
            const isSelected = selectedNotification?.id === notif.id;

            return (
              <div
                key={notif.id}
                className={`group relative rounded-xl border transition-all hover:shadow-md cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700'
                    : !notif.is_read
                      ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                }`}
                onClick={() => handleNotificationClick(notif)}
              >
                <div className="p-4 flex gap-4">
                  {/* Icon */}
                  <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${typeConfig.bg}`}>
                    <typeConfig.Icon className={typeConfig.color} style={{ fontSize: 20 }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`text-sm truncate ${!notif.is_read ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                            {notif.title}
                          </h3>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${typeConfig.bg} ${typeConfig.color}`}>
                            {typeConfig.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {notif.message}
                        </p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                            <span className={`h-1.5 w-1.5 rounded-full ${priorityConfig.dot}`} />
                            {priorityConfig.label}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {formatDate(notif.created_at)}
                          </span>
                          {notif.resource_type && (
                            <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                              <ResourceIcon style={{ fontSize: 10 }} />
                              {notif.resource_type}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        {!notif.is_read && (
                          <button
                            onClick={() => markReadMutation.mutate(notif.id)}
                            disabled={markReadMutation.isPending}
                            className="p-1.5 rounded-full text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                            title="Mark as read"
                          >
                            <CheckIcon style={{ fontSize: 14 }} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteMutation.mutate(notif.id)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Delete"
                        >
                          <DeleteIcon style={{ fontSize: 14 }} />
                        </button>
                      </div>
                    </div>

                    {resourceLink && (
                      <a
                        href={resourceLink}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                      >
                        View {notif.resource_type?.toLowerCase()}
                        <CloseIcon style={{ fontSize: 8, transform: 'rotate(-45deg)' }} />
                      </a>
                    )}
                  </div>

                  {/* Unread indicator */}
                  {!notif.is_read && (
                    <div className="absolute top-4 left-2 h-2 w-2 rounded-full bg-indigo-500" title="Unread" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between mt-6 px-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {(page * 20) + 1}–{Math.min((page + 1) * 20, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * 20 >= total}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedNotification(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div className="p-8 space-y-4">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2 animate-pulse" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full animate-pulse" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 animate-pulse" />
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${NOTIFICATION_TYPE_CONFIG[detailNotif?.type || selectedNotification.type]?.bg || 'bg-slate-100'}`}>
                      {React.createElement(NOTIFICATION_TYPE_CONFIG[detailNotif?.type || selectedNotification.type]?.Icon || NotificationsIcon, {
                        className: NOTIFICATION_TYPE_CONFIG[detailNotif?.type || selectedNotification.type]?.color || 'text-slate-600',
                        style: { fontSize: 20 }
                      })}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{detailNotif?.title || selectedNotification.title}</h2>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${NOTIFICATION_TYPE_CONFIG[detailNotif?.type || selectedNotification.type]?.bg || 'bg-slate-100'} ${NOTIFICATION_TYPE_CONFIG[detailNotif?.type || selectedNotification.type]?.color || 'text-slate-600'}`}>
                        {NOTIFICATION_TYPE_CONFIG[detailNotif?.type || selectedNotification.type]?.label || detailNotif?.type || selectedNotification.type}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedNotification(null)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <CloseIcon style={{ fontSize: 18 }} />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{detailNotif?.message || selectedNotification.message}</p>

                  {/* Product Details */}
                  {isProductNotification && productRec && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
                      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Product Details</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Product</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{productRec.product_name}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">SKU</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{productRec.product_sku}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Current Stock</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{productRec.current_stock}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Reorder Point</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{productRec.reorder_point}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Risk</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{productRec.stock_risk}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Priority</p>
                          <p className={`text-sm font-bold ${PRIORITY_CONFIG[selectedNotification.priority]?.label === 'Critical' ? 'text-red-600' : PRIORITY_CONFIG[selectedNotification.priority]?.label === 'High' ? 'text-orange-600' : 'text-slate-800'}`}>{selectedNotification.priority}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Recommended Quantity</p>
                          <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{productRec.recommended_reorder_quantity}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Import Details */}
                  {isImportNotification && importDetail && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
                      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Import Details</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Filename</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{importDetail.filename}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Type</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{importDetail.import_type}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{importDetail.status}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Records</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{importDetail.total_records}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Successful</p>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{importDetail.successful_records}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Failed</p>
                          <p className="text-sm font-bold text-red-600 dark:text-red-400">{importDetail.failed_records}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Priority Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Priority:</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${PRIORITY_CONFIG[selectedNotification.priority]?.label === 'Critical' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : PRIORITY_CONFIG[selectedNotification.priority]?.label === 'High' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' : PRIORITY_CONFIG[selectedNotification.priority]?.label === 'Medium' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                      {selectedNotification.priority}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    {new Date(selectedNotification.created_at).toLocaleString()}
                  </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
                  <button
                    onClick={() => setSelectedNotification(null)}
                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Close
                  </button>
                  {getResourceLink(selectedNotification) && getResourceLink(selectedNotification) !== '#' && (
                    <button
                      onClick={handleViewResource}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
                    >
                      View {selectedNotification.resource_type?.toLowerCase()}
                      <LaunchIcon style={{ fontSize: 12 }} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
