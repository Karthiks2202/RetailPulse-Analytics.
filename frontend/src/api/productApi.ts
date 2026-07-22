import axiosInstance from './axios';
import type { Category } from './categoryApi';

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
  category: Category | null;
}

export interface ProductCreate {
  name: string;
  sku: string;
  category_id?: string;
  brand?: string;
  description?: string;
  unit_price: number;
  cost_price: number;
  stock_quantity: number;
  low_stock_threshold?: number;
  unit_of_measure: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface ProductUpdate {
  name?: string;
  sku?: string;
  category_id?: string;
  brand?: string;
  description?: string;
  unit_price?: number;
  cost_price?: number;
  stock_quantity?: number;
  low_stock_threshold?: number;
  unit_of_measure?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export const getProducts = async (params?: {
  search?: string;
  category_id?: string;
  status?: string;
  brand?: string;
  sort_by?: string;
  sort_dir?: string;
}): Promise<Product[]> => {
  const { data } = await axiosInstance.get('/products', { params });
  return data;
};

// Active-only products for sales / transaction entry screens.
// Excludes inactive products and is always scoped to the user's company.
export const getActiveProducts = async (params?: {
  search?: string;
  category_id?: string;
}): Promise<Product[]> => {
  const { data } = await axiosInstance.get('/products/active', { params });
  return data;
};

export const getProduct = async (id: string): Promise<Product> => {
  const { data } = await axiosInstance.get(`/products/${id}`);
  return data;
};

export const createProduct = async (payload: ProductCreate): Promise<Product> => {
  const { data } = await axiosInstance.post('/products', payload);
  return data;
};

export const updateProduct = async (id: string, payload: ProductUpdate): Promise<Product> => {
  const { data } = await axiosInstance.put(`/products/${id}`, payload);
  return data;
};

export const deleteProduct = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/products/${id}`);
};

export const activateProduct = async (id: string): Promise<Product> => {
  const { data } = await axiosInstance.patch(`/products/${id}/activate`);
  return data;
};

export const deactivateProduct = async (id: string): Promise<Product> => {
  const { data } = await axiosInstance.patch(`/products/${id}/deactivate`);
  return data;
};
