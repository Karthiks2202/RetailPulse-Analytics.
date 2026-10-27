import axiosInstance from './axios';

export type DataQualityIssueType =
  | 'sale_exceeds_stock'
  | 'inventory_inconsistent_with_movements'
  | 'sale_references_inactive_product'
  | 'sale_references_invalid_customer'
  | 'duplicate_product_sku'
  | 'missing_mandatory_product_info'
  | 'missing_mandatory_customer_info'
  | 'stock_movement_inconsistent_quantities'
  | 'report_total_mismatch';

export type DataQualityIssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type DataQualityIssueStatus = 'open' | 'investigating' | 'resolved' | 'ignored';
export type ReconciliationRunStatus = 'pending' | 'running' | 'completed' | 'completed_with_issues' | 'failed';

export interface DataQualityIssue {
  id: string;
  company_id: string;
  issue_type: DataQualityIssueType;
  severity: DataQualityIssueSeverity;
  status: DataQualityIssueStatus;
  affected_module: string;
  affected_record_id: string | null;
  affected_record_type: string | null;
  description: string;
  details: Record<string, any> | null;
  detected_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  previous_status: string | null;
  resolution_note?: string | null;
}

export interface DataQualityIssueCreate {
  issue_type: DataQualityIssueType;
  severity: DataQualityIssueSeverity;
  status?: DataQualityIssueStatus;
  affected_module: string;
  affected_record_id?: string;
  affected_record_type?: string;
  description: string;
  details?: Record<string, any>;
}

export interface DataQualityIssueUpdate {
  status?: DataQualityIssueStatus;
  resolution_note?: string;
  resolved_by?: string;
}

export interface DataQualityIssueListResponse {
  items: DataQualityIssue[];
  total: number;
  page: number;
  page_size: number;
}

export interface ReconciliationRun {
  id: string;
  company_id: string;
  triggered_by: string | null;
  status: ReconciliationRunStatus;
  started_at: string;
  completed_at: string | null;
  records_checked: number;
  issues_detected: number;
  issues_resolved: number;
  failed_checks: number;
  check_results: Record<string, any> | null;
  error_message: string | null;
}

export interface ReconciliationRunCreate {
  company_id: string;
  triggered_by?: string;
}

export interface ReconciliationRunListResponse {
  items: ReconciliationRun[];
  total: number;
  page: number;
  page_size: number;
}

export interface DataQualityDashboard {
  total_records_checked: number;
  valid_records: number;
  records_with_warnings: number;
  records_with_errors: number;
  unresolved_issues: number;
  last_reconciliation_time: string | null;
  total_issues: number;
  resolved_issues: number;
}

export interface ReconcileRequest {
  company_id?: string;
  triggered_by?: string;
}

export interface ReconcileResult {
  run_id: string;
  status: ReconciliationRunStatus;
  records_checked: number;
  issues_detected: number;
  issues_resolved: number;
  failed_checks: number;
  error_message: string | null;
  check_results: Record<string, any> | null;
}

export const getDataQualityDashboard = async (): Promise<DataQualityDashboard> => {
  const { data } = await axiosInstance.get('/data-quality/dashboard');
  return data;
};

export const getDataQualityIssues = async (params?: {
  page?: number;
  page_size?: number;
  issue_type?: DataQualityIssueType;
  severity?: DataQualityIssueSeverity;
  module?: string;
  status?: DataQualityIssueStatus;
  search?: string;
  date_from?: string;
  date_to?: string;
}): Promise<DataQualityIssueListResponse> => {
  const { data } = await axiosInstance.get('/data-quality/issues', { params });
  return data;
};

export const getDataQualityIssue = async (id: string): Promise<DataQualityIssue> => {
  const { data } = await axiosInstance.get(`/data-quality/issues/${id}`);
  return data;
};

export const updateDataQualityIssueStatus = async (
  id: string,
  payload: DataQualityIssueUpdate,
): Promise<DataQualityIssue> => {
  const { data } = await axiosInstance.put(`/data-quality/issues/${id}/status`, payload);
  return data;
};

export const triggerReconciliation = async (payload?: ReconcileRequest): Promise<ReconcileResult> => {
  const { data } = await axiosInstance.post('/data-quality/reconcile', payload || {});
  return data;
};

export const getReconciliationRuns = async (params?: {
  page?: number;
  page_size?: number;
}): Promise<ReconciliationRunListResponse> => {
  const { data } = await axiosInstance.get('/data-quality/reconciliation-runs', { params });
  return data;
};
