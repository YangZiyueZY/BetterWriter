import axios from 'axios';
import type { FileSystemItem } from '../types';
import { setBackendDown, setBackendUp } from '../lib/backendStatus';
import { startLoading, stopLoading } from '../lib/loadingManager';

const defaultApiUrl = typeof window !== 'undefined' ? `http://${window.location.hostname}:3001/api` : 'http://localhost:3001/api';
const API_URL = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.DEV ? '/api' : defaultApiUrl;

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const anyConfig: any = config as any;
  // __bwSkipLoading 用于后台轮询/自动同步等“静默请求”，避免频繁触发全屏全局 Loading 干扰编辑与开发者面板。
  if (typeof window !== 'undefined' && !anyConfig.__bwSkipLoading) {
    anyConfig.__bwLoadingToken = startLoading();
  }
  let token: string | undefined;
  try {
    const raw = localStorage.getItem('betterwriter-storage-v2');
    const state = raw ? JSON.parse(raw) : undefined;
    token = state?.state?.token;
  } catch {
    localStorage.removeItem('betterwriter-storage-v2');
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    setBackendUp();
    const anyConfig: any = response?.config as any;
    if (anyConfig?.__bwLoadingToken) stopLoading(anyConfig.__bwLoadingToken);
    return response;
  },
  (error) => {
    const anyConfig: any = error?.config as any;
    if (anyConfig?.__bwLoadingToken) stopLoading(anyConfig.__bwLoadingToken);
    const status = error?.response?.status;
    const code = error?.response?.data?.code;
    const hasResponse = Boolean(error?.response);
    const networkCode = String(error?.code || '');
    const isNetworkError =
      !hasResponse ||
      networkCode === 'ERR_NETWORK' ||
      networkCode === 'ECONNABORTED' ||
      status === 502 ||
      status === 503 ||
      status === 504;
    if (typeof window !== 'undefined' && isNetworkError) {
      setBackendDown('无法连接到后端服务，请检查服务是否启动或网络是否正常');
    }
    if (
      typeof window !== 'undefined' &&
      status === 401 &&
      (code === 'SERVER_RESTARTED' || code === 'PASSWORD_CHANGED' || code === 'SESSION_EXPIRED' || code === 'DEVICE_REMOVED')
    ) {
      try {
        localStorage.removeItem('betterwriter-storage-v2');
      } catch {}
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export const fileApi = {
  getAll: async () => {
    const response = await api.get<FileSystemItem[]>('/files');
    return response.data;
  },
  getOne: async (id: string, opts?: { silent?: boolean }) => {
    const response = await api.get<FileSystemItem>(`/files/${id}`, (opts?.silent ? ({ __bwSkipLoading: true } as any) : undefined) as any);
    return response.data;
  },

  upsert: async (file: FileSystemItem, opts?: { silent?: boolean }) => {
    const silent = opts?.silent !== false;
    const response = await api.put(`/files/${file.id}`, file, (silent ? ({ __bwSkipLoading: true } as any) : undefined) as any);
    return response.data;
  },

  delete: async (id: string, opts?: { silent?: boolean }) => {
    const silent = opts?.silent !== false;
    await api.delete(`/files/${id}`, (silent ? ({ __bwSkipLoading: true } as any) : undefined) as any);
  },
};

export const storageApi = {
  get: async () => {
    const response = await api.get('/storage');
    return response.data;
  },
  update: async (payload: any, opts?: { silent?: boolean }) => {
    const response = await api.put('/storage', payload, (opts?.silent ? ({ __bwSkipLoading: true } as any) : undefined) as any);
    return response.data;
  },
  test: async () => {
    const response = await api.post('/storage/test');
    return response.data;
  },
  syncNow: async () => {
    const response = await api.post('/storage/sync-now');
    return response.data;
  },
};

export const userApi = {
  getProfile: async () => {
    const response = await api.get('/user/profile');
    return response.data;
  },
  updateProfile: async (payload: { avatar?: string }) => {
    const response = await api.put('/user/profile', payload);
    return response.data;
  },
  uploadAvatar: async (formData: FormData) => {
    const response = await api.post('/user/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  listDevices: async (params?: any) => {
    const response = await api.get('/user/devices', { params });
    return response.data;
  },
  deleteDevice: async (id: string, password: string) => {
    const response = await api.delete(`/user/devices/${id}`, { data: { password } });
    return response.data;
  },
  bulkDeleteDevices: async (ids: string[], password: string) => {
    const response = await api.post('/user/devices/bulk-delete', { ids, password });
    return response.data;
  },
  undoDeleteDevice: async (id: string) => {
    const response = await api.post(`/user/devices/${id}/undo`);
    return response.data;
  },
  listSecurityAlerts: async (params?: { onlyUnread?: boolean }) => {
    const response = await api.get('/user/security-alerts', { params });
    return response.data;
  },
  readSecurityAlert: async (id: string) => {
    const response = await api.post(`/user/security-alerts/${id}/read`);
    return response.data;
  },
};

export const uploadApi = {
  uploadImage: async (formData: FormData, onUploadProgress?: (progressEvent: any) => void) => {
    const response = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
      __bwSkipLoading: true,
    } as any);
    return response.data;
  },
};

export const adminApi = {
  listUsers: async (params?: { q?: string; status?: string; page?: number; limit?: number }) => {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },
  updateUserStatus: async (id: number, status: 'active' | 'disabled') => {
    const response = await api.patch(`/admin/users/${id}/status`, { status });
    return response.data;
  },
  bulkStatus: async (ids: number[], status: 'active' | 'disabled') => {
    const response = await api.post('/admin/users/bulk-status', { ids, status });
    return response.data;
  },
  resetPassword: async (id: number, newPassword?: string) => {
    const response = await api.post(`/admin/users/${id}/reset-password`, { newPassword });
    return response.data;
  },
  deleteUser: async (id: number) => {
    const response = await api.delete(`/admin/users/${id}`);
    return response.data;
  },
  bulkDelete: async (ids: number[]) => {
    const response = await api.post('/admin/users/bulk-delete', { ids });
    return response.data;
  },
  listAudits: async (params?: { page?: number; limit?: number }) => {
    const response = await api.get('/admin/audits', { params });
    return response.data;
  },
  getMetrics: async () => {
    const response = await api.get('/admin/metrics', { __bwSkipLoading: true } as any);
    return response.data;
  },
  getBackendLogs: async (params?: { level?: string; module?: string; q?: string; from?: number; to?: number; limit?: number }) => {
    const response = await api.get('/admin/logs', { params, __bwSkipLoading: true } as any);
    return response.data;
  },
};

export default api;
