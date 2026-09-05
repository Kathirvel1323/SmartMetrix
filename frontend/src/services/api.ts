import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach JWT bearer token from localStorage
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('smartmetrix_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 unauthorized automatically
apiClient.interceptors.response.use(
  (response) => {
    const contentType = String(response.headers?.['content-type'] || '');
    if (contentType.includes('text/html')) {
      return Promise.reject(new Error('SmartMetrix API is unavailable. Check the backend deployment configuration.'));
    }
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token on 401 if not logging in
      if (!error.config.url?.includes('/auth/login')) {
        localStorage.removeItem('smartmetrix_token');
        localStorage.removeItem('smartmetrix_user');
      }
    }
    return Promise.reject(error);
  }
);
