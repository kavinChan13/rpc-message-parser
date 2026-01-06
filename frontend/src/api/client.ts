import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// API Base URL - 支持反向代理部署
// import.meta.env.BASE_URL 会自动从 vite.config.ts 的 base 选项获取
// 例如: BASE_URL = '/rpc-parser/' 时，API_BASE_URL = '/rpc-parser/api'
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const API_BASE_URL = `${basePath}/api`;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      // 使用 basePath 支持反向代理部署
      window.location.href = `${basePath}/login`;
    }
    return Promise.reject(error);
  }
);

// Auth API - simplified version, username only
export const authAPI = {
  login: async (username: string) => {
    const response = await apiClient.post('/auth/login', { username });
    return response.data;
  },
  getMe: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  }
};

// Files API
export const filesAPI = {
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  parseSelected: async (data: {
    temp_directory: string;
    original_filename: string;
    selected_files: any[];
  }) => {
    const response = await apiClient.post('/files/parse-selected', data);
    return response.data;
  },
  list: async () => {
    const response = await apiClient.get('/files');
    return response.data;
  },
  get: async (id: number) => {
    const response = await apiClient.get(`/files/${id}`);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await apiClient.delete(`/files/${id}`);
    return response.data;
  }
};

// Messages API
export const messagesAPI = {
  getRPCMessages: async (fileId: number, params: {
    page?: number;
    page_size?: number;
    message_type?: string;
    direction?: string;
    operation?: string;
    keyword?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}) => {
    const response = await apiClient.get(`/messages/${fileId}/rpc`, { params });
    return response.data;
  },
  getRPCDetail: async (fileId: number, messageId: number) => {
    const response = await apiClient.get(`/messages/${fileId}/rpc/${messageId}`);
    return response.data;
  },
  getErrors: async (fileId: number, params: {
    page?: number;
    page_size?: number;
    error_type?: string;
  } = {}) => {
    const response = await apiClient.get(`/messages/${fileId}/errors`, { params });
    return response.data;
  },
  getErrorDetail: async (fileId: number, errorId: number) => {
    const response = await apiClient.get(`/messages/${fileId}/errors/${errorId}`);
    return response.data;
  },
  getStatistics: async (fileId: number) => {
    const response = await apiClient.get(`/messages/${fileId}/statistics`);
    return response.data;
  }
};

// Carriers API
export const carriersAPI = {
  getEvents: async (fileId: number, params: {
    page?: number;
    page_size?: number;
    carrier_type?: string;
    event_type?: string;
    carrier_name?: string;
    direction?: string;
  } = {}) => {
    const response = await apiClient.get(`/carriers/${fileId}/events`, { params });
    return response.data;
  },
  getEventDetail: async (fileId: number, eventId: number) => {
    const response = await apiClient.get(`/carriers/${fileId}/events/${eventId}`);
    return response.data;
  },
  getStatistics: async (fileId: number) => {
    const response = await apiClient.get(`/carriers/${fileId}/statistics`);
    return response.data;
  },
  getTimeline: async (fileId: number, carrierName: string) => {
    const response = await apiClient.get(`/carriers/${fileId}/timeline/${encodeURIComponent(carrierName)}`);
    return response.data;
  }
};
