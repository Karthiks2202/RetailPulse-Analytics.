import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const setAuthHeader = (headers: any, token: string) => {
  if (!headers) return;
  if (typeof headers.set === 'function') {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers.Authorization = `Bearer ${token}`;
  }
};

// Attach access token to outgoing requests
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      setAuthHeader(config.headers, token);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercept 401s and perform Token Refresh Rotation
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (token) {
      promise.resolve(token);
    } else {
      promise.reject(error);
    }
  });
  failedQueue = [];
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Guard against recursion and only act on 401 errors for non-refresh endpoints
    const isRefreshEndpoint = originalRequest.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              setAuthHeader(originalRequest.headers, token);
              resolve(axiosInstance(originalRequest));
            },
            reject: (err: any) => reject(err),
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const storedRefreshToken = localStorage.getItem('refreshToken');
      if (!storedRefreshToken) {
        isRefreshing = false;
        localStorage.clear();
        window.dispatchEvent(new Event('auth_session_expired'));
        return Promise.reject(error);
      }

      try {
        const { data } = await axiosInstance.post('/auth/refresh', {
          refresh_token: storedRefreshToken,
        });

        const { access_token: accessToken, refresh_token: newRefreshToken } = data;

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        if (axiosInstance.defaults.headers.common) {
          if (typeof axiosInstance.defaults.headers.common.set === 'function') {
            axiosInstance.defaults.headers.common.set('Authorization', `Bearer ${accessToken}`);
          } else {
            axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          }
        }
        setAuthHeader(originalRequest.headers, accessToken);

        processQueue(null, accessToken);
        isRefreshing = false;

        return axiosInstance(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        isRefreshing = false;
        localStorage.clear();
        window.dispatchEvent(new Event('auth_session_expired'));
        return Promise.reject(refreshErr);
      }
    }

    if (isRefreshEndpoint) {
      localStorage.clear();
      window.dispatchEvent(new Event('auth_session_expired'));
    }

    return Promise.reject(error);
  }
);
export default axiosInstance;
