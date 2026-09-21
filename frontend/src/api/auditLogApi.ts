import axiosInstance from './axios';

export interface AuditLog {
  id: string;
  company_id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  description: string | null;
  ip_address: string;
  user_agent: string;
  before_values: Record<string, any> | null;
  after_values: Record<string, any> | null;
  status: string;
  created_at: string;
}

export interface AuditLogListResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

export const getAuditLogs = async (params?: {
  user_id?: string;
  action?: string;
  resource_type?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: string;
  page?: number;
  limit?: number;
}): Promise<AuditLogListResponse> => {
  const { data } = await axiosInstance.get('/audit-logs', { params });
  return data;
};

export const getAuditLog = async (id: string): Promise<AuditLog> => {
  const { data } = await axiosInstance.get(`/audit-logs/${id}`);
  return data;
};

export const clearAuditLogs = async (before_date?: string, confirm: boolean = false): Promise<{ message: string; deleted_count: number }> => {
  const { data } = await axiosInstance.post('/audit-logs/clear', null, { params: { before_date, confirm } });
  return data;
};

export const exportAuditLogsCsv = async (params?: {
  user_id?: string;
  action?: string;
  resource_type?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}): Promise<Blob> => {
  const { data } = await axiosInstance.get('/audit-logs/export/csv', { params, responseType: 'blob' });
  return data;
};

export const exportAuditLogsPdf = async (params?: {
  user_id?: string;
  action?: string;
  resource_type?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}): Promise<Blob> => {
  const { data } = await axiosInstance.get('/audit-logs/export/pdf', { params, responseType: 'blob' });
  return data;
};
