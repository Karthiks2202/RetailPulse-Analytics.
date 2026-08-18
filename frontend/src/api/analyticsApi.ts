import axiosInstance from './axios';
import type { TopCustomerResponse } from './customerApi';

export interface AnalyticsFilters {
  date_from?: string;
  date_to?: string;
  product_id?: string;
  category_id?: string;
  brand?: string;
  sales_channel?: string;
  payment_method?: string;
  customer_id?: string;
}

export interface Product {
  id: string;
  company_id: string;
  name: string;
  sku: string;
  category_id: string | null;
  brand: string | null;
  description: string | null;
  unit_price: number;
  cost_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  unit_of_measure: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  product_count: number;
}

export interface KPIDashboardResponse {
  total_revenue: number;
  total_orders: number;
  total_products_sold: number;
  average_order_value: number;
  total_discount: number;
  total_tax: number;
  total_inventory_value: number;
  low_stock_products: number;
  out_of_stock_products: number;
  total_categories: number;
}

export interface RevenueTrendPoint {
  period: string;
  revenue: number;
  orders: number;
}

export interface SalesTrendPoint {
  period: string;
  sales: number;
  quantity: number;
}

export interface TopProductResponse {
  product_id: string;
  product_name: string;
  sku: string;
  category_name: string | null;
  brand: string | null;
  total_quantity: number;
  total_revenue: number;
}

export interface TopCategoryResponse {
  category_id: string | null;
  category_name: string;
  total_quantity: number;
  total_revenue: number;
  product_count: number;
}

export interface PaginatedTopProductsResponse {
  items: TopProductResponse[];
  total: number;
  page: number;
  page_size: number;
}

export interface PaginatedTopCategoriesResponse {
  items: TopCategoryResponse[];
  total: number;
  page: number;
  page_size: number;
}

export interface PaginatedTopCustomersResponse {
  items: TopCustomerResponse[];
  total: number;
  page: number;
  page_size: number;
}

export interface PaymentMethodBreakdown {
  payment_method: string;
  total_orders: number;
  total_revenue: number;
  percentage: number;
}

export interface SalesChannelBreakdown {
  sales_channel: string;
  total_orders: number;
  total_revenue: number;
  percentage: number;
}

export interface InventoryDistributionCategory {
  category_id: string | null;
  category_name: string;
  product_count: number;
  total_stock: number;
  total_value: number;
}

export interface StockStatusSummary {
  status: string;
  product_count: number;
  percentage: number;
}

export interface LowStockProductResponse {
  product_id: string;
  product_name: string;
  sku: string;
  category_name: string | null;
  brand: string | null;
  stock_quantity: number;
  available_stock: number;
  low_stock_threshold: number;
  unit_price: number;
  inventory_value: number;
}

export interface OutOfStockProductResponse {
  product_id: string;
  product_name: string;
  sku: string;
  category_name: string | null;
  brand: string | null;
  last_sale_date: string | null;
  unit_price: number;
}

export interface InventoryValueByCategory {
  category_id: string | null;
  category_name: string;
  total_products: number;
  total_stock: number;
  total_cost_value: number;
  total_retail_value: number;
}

export interface DrillDownCategoryProductResponse {
  product_id: string;
  product_name: string;
  sku: string;
  brand: string | null;
  stock_quantity: number;
  available_stock: number;
  unit_price: number;
  cost_price: number;
  low_stock_threshold: number;
  stock_status: string;
  total_sold: number;
  total_revenue: number;
}

export interface DrillDownTransactionResponse {
  id: string;
  invoice_number: string;
  sale_date: string;
  customer_name: string | null;
  sales_channel: string;
  payment_method: string;
  total_amount: number;
  status: string;
  items: Array<{
    product_id: string | null;
    quantity: number;
    unit_price: number;
    total: number;
    product_name: string | null;
  }>;
}

export interface DrillDownProductResponse {
  product_id: string;
  product_name: string;
  sku: string;
  category_name: string | null;
  brand: string | null;
  stock_quantity: number;
  unit_price: number;
  total_sold: number;
  total_revenue: number;
}

export interface DrillDownProductTransactionResponse {
  id: string;
  invoice_number: string;
  sale_date: string;
  customer_name: string | null;
  sales_channel: string;
  payment_method: string;
  total_amount: number;
  status: string;
  items: Array<{
    product_id: string | null;
    quantity: number;
    unit_price: number;
    total: number;
    product_name: string | null;
  }>;
}

export interface KPIDetailResponse {
  transactions: DrillDownTransactionResponse[];
  products: DrillDownProductResponse[];
  low_stock_products: LowStockProductResponse[];
  out_of_stock_products: OutOfStockProductResponse[];
}

export interface ExportRequest {
  export_type: 'csv' | 'pdf';
  report_type: 'kpis' | 'sales' | 'inventory' | 'transactions' | 'top-products' | 'top-customers' | 'payment-methods';
  filters?: AnalyticsFilters;
}

export const getKPIDashboard = async (filters?: AnalyticsFilters): Promise<KPIDashboardResponse> => {
  const { data } = await axiosInstance.get('/analytics/kpis', { params: filters });
  return data;
};

export const getRevenueTrend = async (interval = 'daily', filters?: AnalyticsFilters): Promise<RevenueTrendPoint[]> => {
  const { data } = await axiosInstance.get('/analytics/revenue-trend', { params: { interval, ...filters } });
  return data;
};

export const getSalesTrend = async (interval = 'daily', filters?: AnalyticsFilters): Promise<SalesTrendPoint[]> => {
  const { data } = await axiosInstance.get('/analytics/sales-trend', { params: { interval, ...filters } });
  return data;
};

export const getTopProducts = async (limit = 10, filters?: AnalyticsFilters, page = 1, page_size = 10, sort_by?: string, sort_order?: string): Promise<PaginatedTopProductsResponse> => {
  const { data } = await axiosInstance.get('/analytics/top-products', { params: { limit, page, page_size, sort_by, sort_order, ...filters } });
  return data;
};

export const getTopCategories = async (limit = 10, filters?: AnalyticsFilters, page = 1, page_size = 10): Promise<PaginatedTopCategoriesResponse> => {
  const { data } = await axiosInstance.get('/analytics/top-categories', { params: { limit, page, page_size, ...filters } });
  return data;
};

export const getTopCustomers = async (limit = 10, filters?: AnalyticsFilters, page = 1, page_size = 10): Promise<PaginatedTopCustomersResponse> => {
  const { data } = await axiosInstance.get('/analytics/top-customers', { params: { limit, page, page_size, ...filters } });
  return data;
};

export const getPaymentMethods = async (filters?: AnalyticsFilters): Promise<PaymentMethodBreakdown[]> => {
  const { data } = await axiosInstance.get('/analytics/payment-methods', { params: filters });
  return data;
};

export const getSalesChannels = async (filters?: AnalyticsFilters): Promise<SalesChannelBreakdown[]> => {
  const { data } = await axiosInstance.get('/analytics/sales-channels', { params: filters });
  return data;
};

export const getInventoryDistribution = async (filters?: AnalyticsFilters): Promise<InventoryDistributionCategory[]> => {
  const { data } = await axiosInstance.get('/analytics/inventory-distribution', { params: filters });
  return data;
};

export const getStockStatus = async (filters?: AnalyticsFilters): Promise<StockStatusSummary[]> => {
  const { data } = await axiosInstance.get('/analytics/stock-status', { params: filters });
  return data;
};

export const getLowStockProducts = async (limit = 20, filters?: AnalyticsFilters): Promise<LowStockProductResponse[]> => {
  const { data } = await axiosInstance.get('/analytics/low-stock', { params: { limit, ...filters } });
  return data;
};

export const getOutOfStockProducts = async (limit = 50, filters?: AnalyticsFilters): Promise<OutOfStockProductResponse[]> => {
  const { data } = await axiosInstance.get('/analytics/out-of-stock', { params: { limit, ...filters } });
  return data;
};

export const getInventoryValue = async (filters?: AnalyticsFilters): Promise<InventoryValueByCategory[]> => {
  const { data } = await axiosInstance.get('/analytics/inventory-value', { params: filters });
  return data;
};

export const getDrillDownTransactions = async (filters?: AnalyticsFilters): Promise<DrillDownTransactionResponse[]> => {
  const { data } = await axiosInstance.get('/analytics/drill-down/transactions', { params: filters });
  return data;
};

export const getDrillDownProducts = async (filters?: AnalyticsFilters): Promise<DrillDownProductResponse[]> => {
  const { data } = await axiosInstance.get('/analytics/drill-down/products', { params: filters });
  return data;
};

export const getDrillDownCategoryProducts = async (categoryId: string, filters?: AnalyticsFilters): Promise<DrillDownCategoryProductResponse[]> => {
  const { data } = await axiosInstance.get(`/analytics/drill-down/category-products/${categoryId}`, { params: filters });
  return data;
};

export const getDrillDownProductTransactions = async (productId: string, filters?: AnalyticsFilters): Promise<DrillDownProductTransactionResponse[]> => {
  const { data } = await axiosInstance.get(`/analytics/drill-down/product-transactions/${productId}`, { params: filters });
  return data;
};

export const getDrillDownKpiDetail = async (filters?: AnalyticsFilters): Promise<KPIDetailResponse> => {
  const { data } = await axiosInstance.get('/analytics/drill-down/kpi-detail', { params: filters });
  return data;
};

export const refreshAnalytics = async (): Promise<{ status: string; timestamp: string }> => {
  const { data } = await axiosInstance.post('/analytics/refresh');
  return data;
};

export const getBrands = async (): Promise<string[]> => {
  const { data } = await axiosInstance.get('/inventory/brands');
  return data;
};

export const getProducts = async (params?: { status?: string }): Promise<Product[]> => {
  const { data } = await axiosInstance.get('/products', { params });
  return data;
};

export const getCategories = async (): Promise<Category[]> => {
  const { data } = await axiosInstance.get('/categories');
  return data;
};

export const logAnalyticsEvent = async (payload: { action: string; entity_name?: string; details?: string; export_type?: string }) => {
  const { data } = await axiosInstance.post('/analytics/log', payload);
  return data;
};

export const exportAnalytics = async (payload: ExportRequest): Promise<Blob> => {
  const response = await axiosInstance.post('/analytics/export', payload, { responseType: 'blob' });
  return response.data;
};
