import axiosInstance from './axios';

export type ImportType = 'PRODUCTS' | 'INVENTORY' | 'CUSTOMERS' | 'SALES';

export type ImportStatus =
  | 'PENDING'
  | 'UPLOADED'
  | 'VALIDATING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED'
  | 'CANCELLED';

export type DuplicateStrategy = 'REJECT' | 'SKIP' | 'UPDATE';

export interface ImportHistoryItem {
  id: string;
  company_id: string;
  import_type: string;
  filename: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  total_records: number;
  successful_records: number;
  failed_records: number;
  skipped_records: number;
  duplicate_records: number;
  status: string;
  duplicate_strategy: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
}

export interface ImportErrorItem {
  id?: string;
  import_id?: string;
  row_number: number;
  field: string | null;
  error_type: string | null;
  error_message: string;
  raw_data: string | null;
  processing_status: string | null;
}

export interface ImportPreviewResponse {
  import_id: string;
  import_type: string;
  filename: string;
  duplicate_strategy?: string;
  total_records: number;
  columns: string[];
  preview_rows: Record<string, string>[];
  valid_records: number;
  invalid_records: number;
  duplicate_records: number;
  errors: ImportErrorItem[];
  status: string;
}

export interface ImportStatusResponse {
  import_id: string;
  import_type: string;
  filename: string;
  status: string;
  total_records: number;
  processed_records: number;
  successful_records: number;
  failed_records: number;
  skipped_records: number;
  duplicate_records: number;
  progress_percentage: number;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
}

export interface ImportResultResponse {
  import_id: string;
  import_type: string;
  filename: string;
  total_records: number;
  successful_records: number;
  failed_records: number;
  skipped_records: number;
  duplicate_records: number;
  status: string;
  duration_seconds: number | null;
  reconciliation_run?: Record<string, any> | null;
  errors: ImportErrorItem[];
}

export interface ImportUploadResponse {
  import_id: string;
  import_type: string;
  filename: string;
  total_records: number;
  status: string;
  duplicate_strategy?: string;
}

export const getImportHistory = async (params?: {
  import_type?: ImportType | string;
  status?: ImportStatus | string;
  skip?: number;
  limit?: number;
}): Promise<ImportHistoryItem[]> => {
  const { data } = await axiosInstance.get('/import/history', { params });
  return data;
};

export const getImportDetail = async (importId: string): Promise<ImportHistoryItem> => {
  const { data } = await axiosInstance.get(`/import/${importId}`);
  return data;
};

export const getImportStatus = async (importId: string): Promise<ImportStatusResponse> => {
  const { data } = await axiosInstance.get(`/import/${importId}/status`);
  return data;
};

export const getImportErrors = async (importId: string): Promise<ImportErrorItem[]> => {
  const { data } = await axiosInstance.get(`/import/${importId}/errors`);
  return data;
};

export const uploadImport = async (
  importType: ImportType,
  file: File,
  duplicateStrategy: DuplicateStrategy = 'REJECT'
): Promise<ImportUploadResponse> => {
  const form = new FormData();
  form.append('import_type', importType);
  form.append('duplicate_strategy', duplicateStrategy);
  form.append('file', file);
  const { data } = await axiosInstance.post('/import/upload', form);
  return data;
};

export const validateImport = async (
  importType: ImportType,
  file?: File,
  importId?: string,
  duplicateStrategy: DuplicateStrategy = 'REJECT'
): Promise<ImportPreviewResponse> => {
  const form = new FormData();
  form.append('import_type', importType);
  form.append('duplicate_strategy', duplicateStrategy);
  if (file) {
    form.append('file', file);
  }
  if (importId) {
    form.append('import_id', importId);
  }
  const { data } = await axiosInstance.post('/import/validate', form);
  return data;
};

export const processImport = async (
  importType: ImportType,
  file?: File,
  importId?: string,
  duplicateStrategy: DuplicateStrategy = 'REJECT',
  background: boolean = false
): Promise<ImportResultResponse> => {
  const form = new FormData();
  form.append('import_type', importType);
  form.append('duplicate_strategy', duplicateStrategy);
  if (file) {
    form.append('file', file);
  }
  if (importId) {
    form.append('import_id', importId);
  }
  const { data } = await axiosInstance.post('/import/process', form, {
    params: { background },
  });
  return data;
};

export const startImportJob = async (importId: string): Promise<{ import_id: string; status: string; message: string }> => {
  const { data } = await axiosInstance.post(`/import/${importId}/start`);
  return data;
};

export const cancelImport = async (importId: string): Promise<{ import_id: string; status: string; message: string }> => {
  const { data } = await axiosInstance.post(`/import/${importId}/cancel`);
  return data;
};

export const downloadTemplate = async (importType: ImportType): Promise<void> => {
  const response = await axiosInstance.get(`/import/template/${importType.toLowerCase()}`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `template_${importType.toLowerCase()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const downloadErrorReport = async (importId: string, filename?: string): Promise<void> => {
  const response = await axiosInstance.get(`/import/${importId}/errors/download`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename || `import-errors-${importId.slice(0, 8)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
