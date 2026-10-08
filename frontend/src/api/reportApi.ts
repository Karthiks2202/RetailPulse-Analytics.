import axiosInstance from './axios';

export type ReportType = 'sales' | 'inventory' | 'customer' | 'product_performance' | 'stock_movement';
export type ReportFormat = 'csv' | 'pdf';
export type ReportFrequency = 'daily' | 'weekly' | 'monthly';
export type ReportExecutionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ReportFilter {
  date_from?: string;
  date_to?: string;
  product_id?: string;
  category_id?: string;
  brand?: string;
  customer_id?: string;
  sales_status?: string;
  stock_status?: string;
  payment_method?: string;
  payment_status?: string;
  sales_channel?: string;
  movement_type?: string;
  search?: string;
}

export interface ScheduledReport {
  id: string;
  company_id: string;
  created_by: string | null;
  name: string;
  report_type: ReportType;
  filters: Record<string, any>;
  frequency: ReportFrequency;
  execution_time: string;
  recipients: string[];
  export_format: ReportFormat;
  is_active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportHistory {
  id: string;
  company_id: string;
  scheduled_report_id: string | null;
  generated_by: string | null;
  report_name: string;
  report_type: ReportType;
  filters: Record<string, any>;
  export_format: ReportFormat;
  status: ReportExecutionStatus;
  error_message: string | null;
  generated_at: string;
}

export interface ScheduledReportCreate {
  name: string;
  report_type: ReportType;
  filters?: Record<string, any>;
  frequency: ReportFrequency;
  execution_time: string;
  recipients: string[];
  export_format?: ReportFormat;
  is_active?: boolean;
}

export interface ScheduledReportUpdate {
  name?: string;
  report_type?: ReportType;
  filters?: Record<string, any>;
  frequency?: ReportFrequency;
  execution_time?: string;
  recipients?: string[];
  export_format?: ReportFormat;
  is_active?: boolean;
}

export interface ReportGenerateRequest {
  report_type: ReportType;
  filters?: ReportFilter;
  export_format?: ReportFormat;
}

export interface ReportGenerateResponse {
  id: string;
  report_name: string;
  report_type: ReportType;
  export_format: ReportFormat;
  status: ReportExecutionStatus;
  generated_at: string;
  download_url: string | null;
  error_message: string | null;
}

export interface ReportDataResponse {
  columns: string[];
  rows: Record<string, any>[];
  total_rows: number;
  applied_filters: Record<string, any>;
  period: { from: string | null; to: string | null } | null;
}

export interface ReportHistoryListResponse {
  items: ReportHistory[];
  total: number;
  page: number;
  page_size: number;
}

export interface ScheduledReportListResponse {
  items: ScheduledReport[];
  total: number;
  page: number;
  page_size: number;
}

export const getReportData = async (params: {
  report_type: ReportType;
  filters?: ReportFilter;
  page?: number;
  page_size?: number;
}): Promise<ReportDataResponse> => {
  const { data } = await axiosInstance.get('/reports/data', { params });
  return data;
};

export const generateReport = async (payload: ReportGenerateRequest): Promise<ReportGenerateResponse> => {
  const { data } = await axiosInstance.post('/reports/generate', payload);
  return data;
};

export const getReportHistory = async (params?: {
  page?: number;
  page_size?: number;
  report_type?: ReportType;
}): Promise<ReportHistoryListResponse> => {
  const { data } = await axiosInstance.get('/reports/history', { params });
  return data;
};

export const getReportHistoryItem = async (id: string): Promise<ReportHistory> => {
  const { data } = await axiosInstance.get(`/reports/history/${id}`);
  return data;
};

export const downloadReport = async (id: string): Promise<Blob> => {
  const response = await axiosInstance.get(`/reports/history/${id}/download`, { responseType: 'blob' });
  return response.data;
};

export const createScheduledReport = async (payload: ScheduledReportCreate): Promise<ScheduledReport> => {
  const { data } = await axiosInstance.post('/reports/schedules', payload);
  return data;
};

export const getScheduledReports = async (params?: {
  page?: number;
  page_size?: number;
  is_active?: boolean;
}): Promise<ScheduledReportListResponse> => {
  const { data } = await axiosInstance.get('/reports/schedules', { params });
  return data;
};

export const getScheduledReport = async (id: string): Promise<ScheduledReport> => {
  const { data } = await axiosInstance.get(`/reports/schedules/${id}`);
  return data;
};

export const updateScheduledReport = async (id: string, payload: ScheduledReportUpdate): Promise<ScheduledReport> => {
  const { data } = await axiosInstance.put(`/reports/schedules/${id}`, payload);
  return data;
};

export const deleteScheduledReport = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/reports/schedules/${id}`);
};
