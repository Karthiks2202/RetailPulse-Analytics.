import axiosInstance from './axios';

export const listCompanyUsers = async () => {
  const { data } = await axiosInstance.get('/users');
  return data;
};
