import axiosInstance from './axios';

export const registerCompany = async (payload: any) => {
  const { data } = await axiosInstance.post('/auth/register', payload);
  return data;
};

export const loginUser = async (payload: any) => {
  const { data } = await axiosInstance.post('/auth/login', payload);
  return data;
};

export const logoutUser = async (refreshToken: string) => {
  const { data } = await axiosInstance.post('/auth/logout', { refreshToken });
  return data;
};
