import { create } from 'zustand';

export interface UploadTask {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

interface UploadState {
  tasks: UploadTask[];
  
  addTask: (id: string, fileName: string) => void;
  updateProgress: (id: string, progress: number) => void;
  completeTask: (id: string) => void;
  failTask: (id: string, error: string) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  tasks: [],

  addTask: (id, fileName) => set((state) => ({
    tasks: [...state.tasks, { id, fileName, progress: 0, status: 'uploading' }]
  })),

  updateProgress: (id, progress) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, progress } : t)
  })),

  completeTask: (id) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, progress: 100, status: 'completed' } : t)
  })),

  failTask: (id, error) => set((state) => ({
    tasks: state.tasks.map(t => t.id === id ? { ...t, status: 'error', error } : t)
  })),

  removeTask: (id) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== id)
  })),

  clearCompleted: () => set((state) => ({
    tasks: state.tasks.filter(t => t.status !== 'completed')
  }))
}));
