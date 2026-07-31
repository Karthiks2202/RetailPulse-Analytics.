import axiosInstance from './axios';

export interface Customer {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  customer_type: 'RETAIL' | 'WHOLESALE' | 'CORPORATE';
  preferred_sales_channel: string | null;
  notes: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  customer_since: string;
  total_purchases: number;
  total_spent: number;
  last_purchase_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreate {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  customer_type?: 'RETAIL' | 'WHOLESALE' | 'CORPORATE';
  preferred_sales_channel?: string;
  notes?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface CustomerUpdate {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  customer_type?: 'RETAIL' | 'WHOLESALE' | 'CORPORATE';
  preferred_sales_channel?: string;
  notes?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface CustomerPurchaseHistory {
  id: string;
  invoice_number: string;
  sale_date: string;
  sales_channel: string;
  payment_method: string;
  total_amount: number;
  status: string;
  item_count: number;
}

export interface CustomerFrequentProductResponse {
  product_id: string;
  product_name: string;
  sku: string;
  total_quantity_purchased: number;
  total_revenue: number;
}

export interface CustomerPurchaseDetailResponse {
  total_orders: number;
  total_revenue: number;
  total_quantity_purchased: number;
  average_order_value: number;
  first_purchase_date: string | null;
  last_purchase_date: string | null;
  frequently_purchased_products: CustomerFrequentProductResponse[];
  recent_transactions: CustomerPurchaseHistory[];
}

export interface CustomerAnalyticsSummary {
  total_customers: number;
  active_customers: number;
  inactive_customers: number;
  new_customers_this_month: number;
  total_revenue_from_customers: number;
  average_customer_spend: number;
}

export interface CustomerAnalyticsDashboardResponse {
  total_customers: number;
  active_customers: number;
  new_customers: number;
  returning_customers: number;
  average_customer_spend: number;
  total_revenue: number;
  average_purchase_frequency: number;
}

export interface TopCustomerResponse {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  total_purchases: number;
  total_spent: number;
  last_purchase_date: string | null;
}

export interface NewVsReturningResponse {
  new_customers: number;
  returning_customers: number;
  new_customer_revenue: number;
  returning_customer_revenue: number;
}

export interface CustomerGrowthPoint {
  month: string;
  new_customers: number;
}

export interface RevenueByTypePoint {
  customer_type: string;
  revenue: number;
}

export interface LocationDistributionPoint {
  state: string;
  count: number;
  percentage: number;
}

export interface SpendingDistributionResponse {
  buckets: Record<string, number>;
  total_customers: number;
}

export interface PurchaseFrequencyPoint {
  range: string;
  customers: number;
}

export interface CustomerSegmentResponse {
  segments: Record<string, number>;
  total_segmented: number;
}

export interface MonthlyAcquisitionPoint {
  month: string;
  new_customers: number;
}

export interface CustomerFavouriteResponse {
  id: string;
  name: string;
  sku?: string;
}

export interface CustomerDetailedProfileResponse {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  customer_type: string;
  preferred_sales_channel: string | null;
  notes: string | null;
  status: string;
  customer_since: string;
  created_at: string;
  updated_at: string;
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
  first_purchase_date: string | null;
  last_purchase_date: string | null;
  purchase_frequency: number;
  favourite_category: { id: string; name: string } | null;
  favourite_product: { id: string; name: string; sku: string } | null;
  recent_activity: CustomerPurchaseHistory[];
}

export interface CustomerTimelineResponse {
  id: string;
  company_id: string;
  customer_id: string;
  user_id: string | null;
  action: string;
  details: string | null;
  timestamp: string;
}

export const getCustomers = async (params?: {
  search?: string;
  status?: string;
  customer_type?: string;
  city?: string;
  state?: string;
  country?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_dir?: string;
  limit?: number;
}): Promise<Customer[]> => {
  const { data } = await axiosInstance.get('/customers', { params });
  return data;
};

export const getCustomerProfile = async (id: string): Promise<CustomerDetailedProfileResponse> => {
  const { data } = await axiosInstance.get(`/customers/${id}/profile`);
  return data;
};

export const getCustomerTimeline = async (customerId: string, params?: { skip?: number; limit?: number }): Promise<CustomerTimelineResponse[]> => {
  const { data } = await axiosInstance.get(`/customers/${customerId}/timeline`, { params });
  return data;
};

export const getCompanyTimeline = async (params?: { action?: string; customer_id?: string; skip?: number; limit?: number }): Promise<CustomerTimelineResponse[]> => {
  const { data } = await axiosInstance.get('/customers/timeline', { params });
  return data;
};

export const getCustomer = async (id: string): Promise<Customer> => {
  const { data } = await axiosInstance.get(`/customers/${id}`);
  return data;
};

export const createCustomer = async (payload: CustomerCreate): Promise<Customer> => {
  const { data } = await axiosInstance.post('/customers', payload);
  return data;
};

export const updateCustomer = async (id: string, payload: CustomerUpdate): Promise<Customer> => {
  const { data } = await axiosInstance.put(`/customers/${id}`, payload);
  return data;
};

export const deleteCustomer = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/customers/${id}`);
};

export const activateCustomer = async (id: string): Promise<Customer> => {
  const { data } = await axiosInstance.patch(`/customers/${id}/activate`);
  return data;
};

export const deactivateCustomer = async (id: string): Promise<Customer> => {
  const { data } = await axiosInstance.patch(`/customers/${id}/deactivate`);
  return data;
};

export const getCustomerPurchaseHistory = async (id: string, limit = 50): Promise<CustomerPurchaseHistory[]> => {
  const { data } = await axiosInstance.get(`/customers/${id}/purchase-history`, { params: { limit } });
  return data;
};

export const getCustomerPurchaseDetail = async (id: string, recentLimit = 10, topProductsLimit = 5): Promise<CustomerPurchaseDetailResponse> => {
  const { data } = await axiosInstance.get(`/customers/${id}/purchase-detail`, { params: { recent_limit: recentLimit, top_products_limit: topProductsLimit } });
  return data;
};

export const getCustomerAnalyticsSummary = async (): Promise<CustomerAnalyticsSummary> => {
  const { data } = await axiosInstance.get('/customers/analytics/summary');
  return data;
};

export const getCustomerAnalyticsDashboard = async (): Promise<CustomerAnalyticsDashboardResponse> => {
  const { data } = await axiosInstance.get('/customers/analytics/dashboard');
  return data;
};

export const getCustomerGrowth = async (months = 12): Promise<CustomerGrowthPoint[]> => {
  const { data } = await axiosInstance.get('/customers/analytics/growth', { params: { months } });
  return data;
};

export const getRevenueByCustomerType = async (): Promise<RevenueByTypePoint[]> => {
  const { data } = await axiosInstance.get('/customers/analytics/revenue-by-type');
  return data;
};

export const getLocationDistribution = async (): Promise<LocationDistributionPoint[]> => {
  const { data } = await axiosInstance.get('/customers/analytics/location-distribution');
  return data;
};

export const getSpendingDistribution = async (): Promise<SpendingDistributionResponse> => {
  const { data } = await axiosInstance.get('/customers/analytics/spending-distribution');
  return data;
};

export const getPurchaseFrequencyDistribution = async (): Promise<PurchaseFrequencyPoint[]> => {
  const { data } = await axiosInstance.get('/customers/analytics/purchase-frequency');
  return data;
};

export const getCustomerSegmentation = async (): Promise<CustomerSegmentResponse> => {
  const { data } = await axiosInstance.get('/customers/analytics/segmentation');
  return data;
};

export const getMonthlyCustomerAcquisition = async (months = 12): Promise<MonthlyAcquisitionPoint[]> => {
  const { data } = await axiosInstance.get('/customers/analytics/monthly-acquisition', { params: { months } });
  return data;
};

export const getTopCustomers = async (limit = 10): Promise<TopCustomerResponse[]> => {
  const { data } = await axiosInstance.get('/customers/analytics/top', { params: { limit } });
  return data;
};

export const getNewVsReturning = async (params?: {
  date_from?: string;
  date_to?: string;
}): Promise<NewVsReturningResponse> => {
  const { data } = await axiosInstance.get('/customers/analytics/new-vs-returning', { params });
  return data;
};

export const getRecentCustomers = async (limit = 10): Promise<Array<{
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  customer_type: string;
  status: string;
  total_purchases: number;
  total_spent: number;
  last_purchase_date: string | null;
  customer_since: string;
  created_at: string;
}>> => {
  const { data } = await axiosInstance.get('/customers/analytics/recent', { params: { limit } });
  return data;
};

export const getCustomerRevenueContribution = async (limit = 10): Promise<Array<{
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  revenue: number;
}>> => {
  const { data } = await axiosInstance.get('/customers/analytics/revenue-contribution', { params: { limit } });
  return data;
};

export const exportCustomersCSV = async (params?: { status?: string; customer_type?: string; search?: string }): Promise<{ content: string; filename: string }> => {
  const response = await axiosInstance.get('/customers/export/csv', { params });
  return { content: response.data, filename: 'customers.csv' };
};

export const exportCustomersPDF = async (params?: { status?: string; customer_type?: string; search?: string }): Promise<{ content: any; filename: string; message: string }> => {
  const { data } = await axiosInstance.get('/customers/export/pdf', { params });
  return data;
};

export const exportCustomerAnalyticsCSV = async (): Promise<{ content: string; filename: string }> => {
  const response = await axiosInstance.get('/customers/export/analytics/csv');
  return { content: response.data, filename: 'customer_analytics.csv' };
};

export const exportCustomerAnalyticsPDF = async (): Promise<{ content: any; filename: string; message: string }> => {
  const { data } = await axiosInstance.get('/customers/export/analytics/pdf');
  return data;
};

export const exportTopCustomersCSV = async (): Promise<{ content: string; filename: string }> => {
  const response = await axiosInstance.get('/customers/export/top/csv');
  return { content: response.data, filename: 'top_customers.csv' };
};

export const exportTopCustomersPDF = async (): Promise<{ content: any; filename: string; message: string }> => {
  const { data } = await axiosInstance.get('/customers/export/top/pdf');
  return data;
};

export const getCustomerLifetimeValue = async (id: string): Promise<{
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  first_purchase: string | null;
  last_purchase: string | null;
}> => {
  const { data } = await axiosInstance.get(`/customers/${id}/lifetime-value`);
  return data;
};
