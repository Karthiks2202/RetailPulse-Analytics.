import axiosInstance from './axios';

export interface InventoryItem {
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
  reserved_stock: number;
  available_stock: number;
  low_stock_threshold: number;
  stock_status: string;
  unit_of_measure: string;
  category_name: string | null;
}

export interface InventorySummary {
  total_products: number;
  total_inventory_quantity: number;
  low_stock_products: number;
  out_of_stock_products: number;
  in_stock_products: number;
}

export interface InventoryCategoryBreakdown {
  category_name: string;
  product_count: number;
}

export interface InventoryStockStatusBreakdown {
  stock_status: string;
  product_count: number;
}

export interface StockMovement {
  id: string;
  company_id: string;
  product_id: string;
  product_name: string | null;
  product_sku: string | null;
  movement_type: string;
  previous_quantity: number;
  updated_quantity: number;
  quantity_changed: number;
  reason: string;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
}

export interface InventoryAdjustment {
  id: string;
  company_id: string;
  product_id: string;
  product_name: string | null;
  product_sku: string | null;
  adjustment_type: string;
  quantity: number;
  reason: string | null;
  remarks: string | null;
  adjusted_by: string | null;
  adjusted_by_name: string | null;
  adjusted_at: string;
}

export const getInventoryItems = async (params?: {
  search?: string;
  category_id?: string;
  stock_status?: string;
  brand?: string;
  sort_by?: string;
  sort_dir?: string;
  skip?: number;
  limit?: number;
}): Promise<{ data: InventoryItem[]; total: number }> => {
  const { data } = await axiosInstance.get('/inventory', { params });
  return data;
};

export const getInventorySummary = async (): Promise<InventorySummary> => {
  const { data } = await axiosInstance.get('/inventory/summary');
  return data;
};

export const getCategoryBreakdown = async (): Promise<InventoryCategoryBreakdown[]> => {
  const { data } = await axiosInstance.get('/inventory/category-breakdown');
  return data;
};

export const getStatusBreakdown = async (): Promise<InventoryStockStatusBreakdown[]> => {
  const { data } = await axiosInstance.get('/inventory/status-breakdown');
  return data;
};

export const getBrands = async (): Promise<string[]> => {
  const { data } = await axiosInstance.get('/inventory/brands');
  return data;
};

export const getStockMovements = async (params?: {
  product_id?: string;
  movement_type?: string;
  skip?: number;
  limit?: number;
}): Promise<{ data: StockMovement[]; total: number }> => {
  const { data } = await axiosInstance.get('/inventory/movements', { params });
  return data;
};

export const getAdjustments = async (params?: {
  product_id?: string;
  skip?: number;
  limit?: number;
}): Promise<{ data: InventoryAdjustment[]; total: number }> => {
  const { data } = await axiosInstance.get('/inventory/adjustments', { params });
  return data;
};

export const addStock = async (payload: {
  product_id: string;
  quantity: number;
  reason?: string;
  remarks?: string;
}): Promise<InventoryItem> => {
  const { data } = await axiosInstance.post('/inventory/add-stock', payload);
  return data;
};

export const removeStock = async (payload: {
  product_id: string;
  quantity: number;
  reason?: string;
  remarks?: string;
}): Promise<InventoryItem> => {
  const { data } = await axiosInstance.post('/inventory/remove-stock', payload);
  return data;
};

export const adjustStock = async (payload: {
  product_id: string;
  quantity: number;
  reason?: string;
  remarks?: string;
}): Promise<InventoryItem> => {
  const { data } = await axiosInstance.post('/inventory/adjust-stock', payload);
  return data;
};

export const updateReorderLevel = async (productId: string, low_stock_threshold: number): Promise<InventoryItem> => {
  const { data } = await axiosInstance.patch(`/inventory/${productId}/reorder-level`, { low_stock_threshold });
  return data;
};

export interface InventoryForecastItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  category_id: string | null;
  category_name: string | null;
  brand: string | null;
  current_stock: number;
  available_stock: number;
  reserved_stock: number;
  average_daily_sales: number;
  forecasted_demand: number;
  days_of_stock_remaining: number;
  reorder_point: number;
  recommended_reorder_quantity: number;
  stock_risk: string;
  recommendation: string;
  confidence_score: number;
  forecast_period: string;
}

export interface InventoryForecastSummary {
  total_products: number;
  products_requiring_reorder: number;
  products_at_stockout_risk: number;
  overstocked_products: number;
  healthy_products: number;
}

export interface PaginatedInventoryForecastResponse {
  data: InventoryForecastItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductRecommendationDetail {
  product_id: string;
  product_name: string;
  product_sku: string;
  category_name: string | null;
  brand: string | null;
  current_stock: number;
  available_stock: number;
  average_daily_sales: number;
  forecasted_demand: number;
  days_of_stock_remaining: number;
  reorder_point: number;
  recommended_reorder_quantity: number;
  stock_risk: string;
  recommendation: string;
  confidence_score: number;
  forecast_period: string;
  lead_time_days: number;
  safety_stock: number;
  historical_sales: number;
  low_stock_threshold: number;
}

export const getInventoryForecasts = async (params?: {
  forecast_period?: string;
  category_id?: string;
  supplier?: string;
  stock_risk?: string;
  reorder_required?: boolean;
  search?: string;
  sort_by?: string;
  sort_dir?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedInventoryForecastResponse> => {
  const { data } = await axiosInstance.get('/inventory/forecast', { params });
  return data;
};

export const getInventoryForecastSummary = async (forecast_period?: string): Promise<InventoryForecastSummary> => {
  const { data } = await axiosInstance.get('/inventory/forecast/summary', { params: { forecast_period } });
  return data;
};

export const getRecommendations = async (params?: {
  forecast_period?: string;
  category_id?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedInventoryForecastResponse> => {
  const { data } = await axiosInstance.get('/inventory/recommendations', { params });
  return data;
};

export const getProductRecommendation = async (productId: string, forecast_period?: string): Promise<ProductRecommendationDetail> => {
  const { data } = await axiosInstance.get(`/inventory/recommendations/${productId}`, { params: { forecast_period } });
  return data;
};
