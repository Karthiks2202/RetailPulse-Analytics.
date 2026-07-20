import axiosInstance from './axios';

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

export interface CategoryCreate {
  name: string;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface CategoryUpdate {
  name?: string;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export const getCategories = async (search?: string): Promise<Category[]> => {
  const params: any = {};
  if (search) params.search = search;
  const { data } = await axiosInstance.get('/categories', { params });
  return data;
};

export const getCategory = async (id: string): Promise<Category> => {
  const { data } = await axiosInstance.get(`/categories/${id}`);
  return data;
};

export const createCategory = async (payload: CategoryCreate): Promise<Category> => {
  const { data } = await axiosInstance.post('/categories', payload);
  return data;
};

export const updateCategory = async (id: string, payload: CategoryUpdate): Promise<Category> => {
  const { data } = await axiosInstance.put(`/categories/${id}`, payload);
  return data;
};

export const deleteCategory = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/categories/${id}`);
};
