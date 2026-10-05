import axiosInstance from './axios';

export type NotificationType = 
  | 'STOCKOUT_RISK'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'OVERSTOCK'
  | 'IMPORT_COMPLETED'
  | 'IMPORT_FAILED'
  | 'IMPORT_COMPLETED_WITH_ERRORS'
  | 'SALES_ALERT'
  | 'SYSTEM_ALERT'
  | 'CUSTOMER_REGISTERED'
  | 'VIP_STATUS'
  | 'CUSTOMER_INACTIVE'
  | 'FIRST_PURCHASE';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NotificationResourceType = 'PRODUCT' | 'IMPORT' | 'SALE' | 'SYSTEM' | 'INVENTORY';

export interface Notification {
  id: string;
  company_id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  resource_type: NotificationResourceType | null;
  resource_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface NotificationsResponse {
  data: Notification[];
  total: number;
  skip: number;
  limit: number;
}

export interface NotificationFilters {
  type?: NotificationType;
  priority?: NotificationPriority;
  is_read?: boolean;
  resource_type?: NotificationResourceType;
  skip?: number;
  limit?: number;
}

export const getNotifications = async (params?: NotificationFilters): Promise<NotificationsResponse> => {
  const { data } = await axiosInstance.get('/notifications', { params });
  return data;
};

export const getUnreadCount = async (): Promise<{ unread_count: number }> => {
  const { data } = await axiosInstance.get('/notifications/unread-count');
  return data;
};

export const getNotification = async (id: string): Promise<Notification> => {
  const { data } = await axiosInstance.get(`/notifications/${id}`);
  return data;
};

export const markAsRead = async (id: string): Promise<Notification> => {
  const { data } = await axiosInstance.patch(`/notifications/${id}/read`);
  return data;
};

export const markAllAsRead = async (): Promise<{ status: string }> => {
  const { data } = await axiosInstance.patch('/notifications/read-all');
  return data;
};

export const deleteNotification = async (id: string): Promise<{ status: string }> => {
  const { data } = await axiosInstance.delete(`/notifications/${id}`);
  return data;
};

export const cleanupExpiredNotifications = async (): Promise<{ deleted: number }> => {
  const { data } = await axiosInstance.post('/notifications/cleanup-expired');
  return data;
};
