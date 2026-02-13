import axios from 'axios';
import type { FileSystemItem } from '../types';

const defaultApiUrl = typeof window !== 'undefined' ? `http://${window.location.hostname}:3001/api` : 'http://localhost:3001/api';
const API_URL = (import.meta as any).env?.VITE_API_BASE_URL || defaultApiUrl;

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const state = JSON.parse(localStorage.getItem('betterwriter-storage-v2') || '{}');
  const token = state.state?.token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const fileApi = {
  getAll: async () => {
    const response = await api.get<FileSystemItem[]>('/files');
    return response.data;
  },
  getOne: async (id: string) => {
    const response = await api.get<FileSystemItem>(`/files/${id}`);
    return response.data;
  },

  upsert: async (file: FileSystemItem) => {
    const response = await api.put(`/files/${file.id}`, file);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/files/${id}`);
  },
};

export const storageApi = {
  get: async () => {
    const response = await api.get('/storage');
    return response.data;
  },
  update: async (payload: any) => {
    const response = await api.put('/storage', payload);
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

export const mobileApi = {
  getKey: async () => {
    const response = await api.get('/auth/mobile-key');
    return response.data;
  },
  regenerateKey: async () => {
    const response = await api.post('/auth/mobile-key/regenerate');
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
};

export const uploadApi = {
  uploadImage: async (formData: FormData, onUploadProgress?: (progressEvent: any) => void) => {
    const response = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    });
    return response.data;
  },
};

export default api;
