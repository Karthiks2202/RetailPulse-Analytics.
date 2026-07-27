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
