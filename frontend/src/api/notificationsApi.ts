import axiosInstance from './axios';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'SYSTEM';
  is_read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  data: Notification[];
  total: number;
  skip: number;
  limit: number;
}

export const getNotifications = async (params?: {
  skip?: number;
  limit?: number;
}): Promise<NotificationsResponse> => {
  const { data } = await axiosInstance.get('/notifications', { params });
  return data;
};

export const getUnreadCount = async (): Promise<number> => {
  const { data } = await axiosInstance.get('/notifications/unread-count');
  return data.unread_count;
};

export const markAsRead = async (id: string): Promise<Notification> => {
  const { data } = await axiosInstance.patch(`/notifications/${id}/read`);
  return data;
};

export const markAllAsRead = async (): Promise<void> => {
  await axiosInstance.patch('/notifications/read-all');
};
