import axiosInstance from './axios';

export const getCompany = async (companyId: string) => {
  const { data } = await axiosInstance.get(`/companies/${companyId}`);
  return data;
};
