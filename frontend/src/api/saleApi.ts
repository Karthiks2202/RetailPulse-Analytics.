import axiosInstance from './axios';
import type { Category } from './categoryApi';
import type { Product } from './productApi';

export type SalesChannel = 'Retail Store' | 'Online Store' | 'Marketplace';

export type PaymentMethod = 'Cash' | 'Card' | 'UPI' | 'Bank Transfer';
export type PaymentStatus = 'PAID' | 'PENDING' | 'PARTIAL';

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  category_id: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
  total: number;
  product: Product | null;
  category: Category | null;
}

export interface Sale {
  id: string;
  company_id: string;
  invoice_number: string;
  customer_name: string | null;
  sale_date: string;
  sales_channel: SalesChannel;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  total_amount: number;
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  items: SaleItem[];
}

export interface SaleListItem {
  id: string;
  company_id: string;
  invoice_number: string;
  customer_name: string | null;
  sale_date: string;
  sales_channel: SalesChannel;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  total_amount: number;
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  created_by_name: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface SaleSummary {
  total_sales: number;
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
}

export interface SaleCreate {
  customer_id?: string;
  customer_name?: string;
  sale_date?: string;
  sales_channel: SalesChannel;
  payment_method: PaymentMethod;
  notes?: string;
  items: SaleItemCreate[];
}

export interface SaleItemCreate {
  product_id?: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
}

export interface SaleUpdate {
  customer_id?: string;
  customer_name?: string;
  sale_date?: string;
  sales_channel?: SalesChannel;
  payment_method?: PaymentMethod;
  status?: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  items?: SaleItemCreate[];
}

export const getSales = async (params?: {
  search?: string;
  customer_name?: string;
  date_from?: string;
  date_to?: string;
  sales_channel?: string;
  payment_method?: string;
  payment_status?: string;
  category_id?: string;
  sort_by?: string;
  sort_dir?: string;
}): Promise<SaleListItem[]> => {
  const { data } = await axiosInstance.get('/sales', { params });
  return data;
};

export const getSale = async (id: string): Promise<Sale> => {
  const { data } = await axiosInstance.get(`/sales/${id}`);
  return data;
};

export const getSalesSummary = async (): Promise<SaleSummary> => {
  const { data } = await axiosInstance.get('/sales/summary');
  return data;
};

export const createSale = async (payload: SaleCreate): Promise<Sale> => {
  const { data } = await axiosInstance.post('/sales', payload);
  return data;
};

export const updateSale = async (id: string, payload: SaleUpdate): Promise<Sale> => {
  const { data } = await axiosInstance.put(`/sales/${id}`, payload);
  return data;
};

export const deleteSale = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/sales/${id}`);
};

export interface SaleExportCSVResponse {
  content: string;
  filename: string;
}

export interface SaleExportPDFResponse {
  content: any;
  filename: string;
  message: string;
}

export const exportSalesCSV = async (): Promise<SaleExportCSVResponse> => {
  const { data } = await axiosInstance.get('/sales/export/csv');
  return data;
};

export const exportSalesPDF = async (): Promise<SaleExportPDFResponse> => {
  const { data } = await axiosInstance.get('/sales/export/pdf');
  return data;
};
