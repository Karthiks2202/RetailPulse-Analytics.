import axiosInstance from './axios';

export interface MetricCard {
  title: string;
  value: string;
  desc: string;
}

export interface ChannelBreakdown {
  name: string;
  percentage: number;
  value: string;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export interface InventoryCategoryBreakdown {
  category_name: string;
  product_count: number;
}

export interface InventoryStockStatusBreakdown {
  stock_status: string;
  product_count: number;
}

export interface DashboardOverview {
  team_count: number;
  product_count: number;
  active_product_count: number;
  inactive_product_count: number;
  category_count: number;
  total_revenue: number;
  total_sales?: number;
  total_orders?: number;
  average_order_value?: number;
  service_status: string;
  monthly_revenue: MonthlyRevenue[];
  channel_breakdown: ChannelBreakdown[];
}

export const getDashboardOverview = async (): Promise<DashboardOverview> => {
  const { data } = await axiosInstance.get('/dashboard/overview');
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
