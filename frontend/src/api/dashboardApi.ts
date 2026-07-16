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

export interface DashboardOverview {
  team_count: number;
  product_count: number;
  total_revenue: number;
  service_status: string;
  monthly_revenue: MonthlyRevenue[];
  channel_breakdown: ChannelBreakdown[];
}

export const getDashboardOverview = async (): Promise<DashboardOverview> => {
  const { data } = await axiosInstance.get('/dashboard/overview');
  return data;
};
