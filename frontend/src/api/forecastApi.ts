import axiosInstance from './axios';

export interface ForecastFilters {
  product_id?: string;
  category_id?: string;
  forecast_period?: string;
  search?: string;
}

export interface DemandForecastResponse {
  id: string;
  company_id: string;
  product_id: string;
  category_id: string | null;
  forecast_period: string;
  forecast_start_date: string | null;
  forecast_end_date: string | null;
  predicted_demand: number;
  confidence_score: number;
  historical_sales: number;
  recommendation: string | null;
  generated_at: string;
  refreshed_at: string;
}

export interface DemandForecastListItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  category_id: string | null;
  category_name: string | null;
  brand: string | null;
  current_stock: number;
  historical_sales: number;
  predicted_demand: number;
  forecast_period: string;
  confidence_score: number;
  recommendation: string | null;
  generated_at: string;
}

export interface CategoryForecastResponse {
  id: string;
  category_id: string | null;
  category_name: string;
  total_historical_sales: number;
  predicted_demand: number;
  expected_growth_percentage: number;
  forecast_period: string;
  generated_at: string;
}

export interface ForecastKPIsResponse {
  total_predicted_demand: number;
  products_expected_to_run_out: number;
  high_growth_products: number;
  slow_moving_products: number;
  forecast_accuracy: number;
}

export interface ForecastHistoryResponse {
  id: string;
  forecast_id: string;
  historical_sales: number;
  prediction: number;
  accuracy: number | null;
  created_at: string;
}

export interface ForecastExportResponse {
  content: string;
  filename: string;
  content_type: string;
}

export const getForecastKPIs = async (filters?: ForecastFilters): Promise<ForecastKPIsResponse> => {
  const { data } = await axiosInstance.get('/forecast/kpis', { params: filters });
  return data;
};

export const getProductForecasts = async (params?: ForecastFilters & { page?: number; limit?: number; sort_by?: string; sort_dir?: string }): Promise<{ data: DemandForecastListItem[]; total: number; page: number; limit: number }> => {
  const { data } = await axiosInstance.get('/forecast/products', { params });
  return data;
};

export const getCategoryForecasts = async (params?: ForecastFilters & { page?: number; limit?: number; sort_by?: string; sort_dir?: string }): Promise<{ data: CategoryForecastResponse[]; total: number; page: number; limit: number }> => {
  const { data } = await axiosInstance.get('/forecast/categories', { params });
  return data;
};

export const getForecast = async (forecastId: string): Promise<DemandForecastResponse> => {
  const { data } = await axiosInstance.get(`/forecast/${forecastId}`);
  return data;
};

export const getForecastHistory = async (forecastId: string): Promise<ForecastHistoryResponse[]> => {
  const { data } = await axiosInstance.get(`/forecast/${forecastId}/history`);
  return data;
};

export const generateForecasts = async (payload: { forecast_period: string; forecast_start_date?: string; forecast_end_date?: string }): Promise<DemandForecastResponse[]> => {
  const { data } = await axiosInstance.post('/forecast/generate', payload);
  return data;
};

export const refreshForecasts = async (payload: { forecast_period: string; forecast_start_date?: string; forecast_end_date?: string }): Promise<DemandForecastResponse[]> => {
  const { data } = await axiosInstance.post('/forecast/refresh', payload);
  return data;
};

export const getTopPredictedProducts = async (forecast_period?: string) => {
  const { data } = await axiosInstance.get('/forecast/charts/top-products', { params: { forecast_period } });
  return data;
};

export const getAccuracyTrend = async (forecast_period?: string): Promise<Array<{ period: string; historical: number; prediction: number; accuracy: number | null }>> => {
  const { data } = await axiosInstance.get('/forecast/charts/accuracy-trend', { params: { forecast_period } });
  return data;
};

export const exportProductForecastCSV = async (forecast_period?: string): Promise<ForecastExportResponse> => {
  const { data } = await axiosInstance.get('/forecast/export/products', { params: { forecast_period } });
  return data;
};

export const exportCategoryForecastCSV = async (forecast_period?: string): Promise<ForecastExportResponse> => {
  const { data } = await axiosInstance.get('/forecast/export/categories', { params: { forecast_period } });
  return data;
};

export const exportForecastPDF = async (forecast_period?: string) => {
  const { data } = await axiosInstance.get('/forecast/export/report', { params: { forecast_period }, responseType: 'blob' });
  return data;
};
