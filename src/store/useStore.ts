import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FileSystemItem, FileItem, FolderItem, Settings } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { fileApi, storageApi } from '../services/api';

const syncLocks = new Set<string>();
const lastSyncAt = new Map<string, number>();
const pendingSync = new Set<string>();
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
let storageConfigTimer: ReturnType<typeof setTimeout> | null = null;
const DEFAULT_WELCOME_ID = uuidv4();

const parseTime = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
    const d = Date.parse(v);
    if (!Number.isNaN(d)) return d;
  }
  return 0;
};

const normalizeItems = (items: FileSystemItem[]): FileSystemItem[] => {
  const map = new Map<string, FileSystemItem>();
  for (const item of items) {
    if (!item?.id) continue;
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      continue;
    }
    const existingTime = parseTime((existing as any).updatedAt);
    const incomingTime = parseTime((item as any).updatedAt);
    map.set(item.id, incomingTime >= existingTime ? item : existing);
  }
  return Array.from(map.values());
};

interface AppState {
  items: FileSystemItem[];
  activeFileId: string | null;
  sidebarOpen: boolean;
  settings: Settings;
  user: { id: number; username: string; avatar?: string } | null;
  token: string | null;
  
  // Actions
  addFile: (name: string, format: 'txt' | 'md', parentId: string | null) => void;
  createFolder: (name: string, parentId: string | null) => void;
  updateFile: (id: string, content: string) => void;
  renameItem: (id: string, name: string) => void;
  deleteItem: (id: string) => void;
  moveItem: (id: string, newParentId: string | null) => void;
  importFile: (name: string, content: string, parentId: string | null) => void;
  convertFileFormat: (id: string, targetFormat: 'txt' | 'md') => void;
  
  setActiveFile: (id: string | null) => void;
  toggleSidebar: () => void;
  updateSettings: (settings: Partial<Settings>) => void;
  updateUserAvatar: (avatar: string) => void;
  login: (user: { id: number; username: string; avatar?: string }, token: string) => void;
  logout: () => void;
  
  // Sync Actions
  fetchFiles: () => Promise<void>;
  syncFile: (id: string) => Promise<void>;
  checkFileUpdate: (id: string) => Promise<void>;
}

type PersistedAppState = Pick<AppState, 'items' | 'activeFileId' | 'settings' | 'user' | 'token'>;

const DEFAULT_SETTINGS: Settings = {
  storageType: 'local',
  s3Config: {
    endpoint: '',
    bucket: '',
    accessKey: '',
    secretKey: '',
    region: '',
  },
  webDavConfig: {
    url: '',
    username: '',
    password: '',
  },
  darkMode: false,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 16,
  lineHeight: 1.6,
  letterSpacing: 0,
  backgroundImage: '',
  backgroundColor: 'rgb(255, 255, 255)', // 默认银河白
};

export const useStore = create<AppState>()(
  persist<AppState, [], [], PersistedAppState>(
    (set, get) => ({
      items: [
        {
          id: DEFAULT_WELCOME_ID,
          parentId: null,
          name: '欢迎使用',
          type: 'file',
          content: '# 欢迎使用 BetterWriter\n\n开始使用 Markdown 或纯文本进行写作。',
          format: 'md',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      ],
      activeFileId: DEFAULT_WELCOME_ID,
      sidebarOpen: true,
      settings: DEFAULT_SETTINGS,
      user: null,
      token: null,

      fetchFiles: async () => {
        if (!get().token) return;
        try {
            const files = await fileApi.getAll();
            if (files && files.length > 0) {
                set((state) => {
                  const normalized = normalizeItems(files);
                  const exists = state.activeFileId ? normalized.some((i) => i.id === state.activeFileId) : false;
                  const nextActiveFileId =
                    exists
                      ? state.activeFileId
                      : normalized
                          .filter((i): i is FileItem => i.type === 'file')
                          .slice()
                          .sort((a, b) => (parseTime((b as any).updatedAt) - parseTime((a as any).updatedAt)))[0]?.id ?? null;
                  return { items: normalized, activeFileId: nextActiveFileId } as any;
                });
            } else {
                const state = get();
                if (state.items.length > 0) {
                  const fileIds = state.items.filter((i): i is FileItem => i.type === 'file').map((i) => i.id);
                  fileIds.forEach((id) => void state.syncFile(id));
                }
                if (state.activeFileId && !state.items.some((i) => i.id === state.activeFileId)) {
                  const next = state.items.filter((i): i is FileItem => i.type === 'file')[0]?.id ?? null;
                  set({ activeFileId: next } as any);
                }
            }
        } catch (error) {
            console.error('Failed to fetch files:', error);
        }
      },

      syncFile: async (id: string) => {
        if (!get().token) return;
        const now = Date.now();
        const last = lastSyncAt.get(id) || 0;
        const delay = 2000 - (now - last);

        if (syncLocks.has(id)) {
          pendingSync.add(id);
          return;
        }

        if (delay > 0) {
          pendingSync.add(id);
          if (!pendingTimers.has(id)) {
            const timer = setTimeout(() => {
              pendingTimers.delete(id);
              if (!pendingSync.delete(id)) return;
              get().syncFile(id);
            }, delay);
            pendingTimers.set(id, timer);
          }
          return;
        }

        const item = get().items.find(i => i.id === id);
        if (item) {
            try {
                syncLocks.add(id);
                // We send the current item. updatedAt acts as the base version for conflict detection.
                const response = await fileApi.upsert(item);
                // Success: update local updatedAt to match server's new timestamp
                set((state) => ({
                    items: normalizeItems(state.items.map(i => i.id === response.id ? { ...response, updatedAt: Number(response.updatedAt) } : i))
                }));
                lastSyncAt.set(id, Date.now());
            } catch (error: any) {
                if (error.response && error.response.status === 409) {
                    const serverFile = error.response.data.file;
                    console.log('Conflict detected, updating with server version:', serverFile);
                    // Update local store with server version
                    set((state) => ({
                        items: state.items.map(i => i.id === serverFile.id ? { ...serverFile, updatedAt: Number(serverFile.updatedAt) } : i)
                    }));
                } else {
                    console.error('Failed to sync file:', error);
                }
            } finally {
                syncLocks.delete(id);
                if (pendingSync.has(id) && !pendingTimers.has(id)) {
                  setTimeout(() => {
                    if (!pendingSync.delete(id)) return;
                    get().syncFile(id);
                  }, 0);
                }
            }
        }
      },
      
      checkFileUpdate: async (id: string) => {
        if (!get().token) return;
        const item = get().items.find(i => i.id === id);
        if (!item) return;

        try {
            const serverFile = await fileApi.getOne(id, { silent: true });
            const serverTime = parseTime((serverFile as any).updatedAt);
            const localTime = parseTime((item as any).updatedAt);

            if (serverTime > localTime) {
                console.log('Server has newer version, auto-updating...');
                set((state) => ({
                    items: normalizeItems(state.items.map(i => i.id === (serverFile as any).id ? { ...(serverFile as any), updatedAt: serverTime } : i))
                }));
            }
        } catch (error: any) {
            const status = error?.response?.status;
            if (status === 404) {
              void get().syncFile(id);
              return;
            }
            console.error('Check update failed', error);
        }
      },

      addFile: (name, format, parentId) => {
        const newFile: FileItem = {
          id: uuidv4(),
          parentId,
          name,
          type: 'file',
          content: '',
          format,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ items: normalizeItems([...state.items, newFile]), activeFileId: newFile.id }));
        if (get().token) {
          void fileApi
            .upsert(newFile)
            .then((serverItem: any) => {
              set((state) => ({
                items: normalizeItems(state.items.map((i) => (i.id === serverItem.id ? { ...i, ...serverItem } : i))),
              }));
            })
            .catch(console.error);
        }
      },

      createFolder: (name, parentId) => {
        const newFolder: FolderItem = {
          id: uuidv4(),
          parentId,
          name,
          type: 'folder',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ items: normalizeItems([...state.items, newFolder]) }));
        if (get().token) {
          void fileApi
            .upsert(newFolder)
            .then((serverItem: any) => {
              set((state) => ({
                items: normalizeItems(state.items.map((i) => (i.id === serverItem.id ? { ...i, ...serverItem } : i))),
              }));
            })
            .catch(console.error);
        }
      },

      updateFile: (id, content) => set((state) => ({
        items: state.items.map((f) => 
          f.id === id && f.type === 'file' 
            ? { ...f, content } 
            : f
        )
      })),

      renameItem: (id, name) => {
        const existing = get().items.find((f) => f.id === id);
        if (!existing) return;
        const next: any = { ...existing, name, updatedAt: Date.now() };
        set((state) => ({
          items: normalizeItems(state.items.map((f) => (f.id === id ? next : f))),
        }));
        if (get().token) {
          void fileApi
            .upsert(next)
            .then((serverItem: any) => {
              set((state) => ({
                items: normalizeItems(state.items.map((i) => (i.id === serverItem.id ? { ...i, ...serverItem } : i))),
              }));
            })
            .catch(console.error);
        }
      },

      deleteItem: (id) => {
        const state = get();
        const getDescendants = (parentId: string, allItems: FileSystemItem[]): string[] => {
            const children = allItems.filter(i => i.parentId === parentId);
            let ids = children.map(c => c.id);
            children.forEach(c => {
                ids = [...ids, ...getDescendants(c.id, allItems)];
            });
            return ids;
        };
        
        const idsToDelete = [id, ...getDescendants(id, state.items)];
        
        set((state) => {
          const remainingItems = state.items.filter((f) => !idsToDelete.includes(f.id));
          const isDeletingActive = idsToDelete.includes(state.activeFileId || '');

          if (!isDeletingActive) {
            return { items: remainingItems, activeFileId: state.activeFileId };
          }

          const remainingFiles = remainingItems.filter(
            (i): i is FileItem => i.type === 'file'
          );
          const nextActiveFileId =
            remainingFiles
              .slice()
              .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0]?.id ?? null;

          return { items: remainingItems, activeFileId: nextActiveFileId };
        });

        if (state.token) {
            idsToDelete.forEach(itemId => fileApi.delete(itemId).catch(console.error));
        }
      },

      moveItem: (id, newParentId) => {
        const existing = get().items.find((f) => f.id === id);
        if (!existing) return;
        const next: any = { ...existing, parentId: newParentId, updatedAt: Date.now() };
        set((state) => ({
          items: normalizeItems(state.items.map((f) => (f.id === id ? next : f))),
        }));
        if (get().token) {
          void fileApi
            .upsert(next)
            .then((serverItem: any) => {
              set((state) => ({
                items: normalizeItems(state.items.map((i) => (i.id === serverItem.id ? { ...i, ...serverItem } : i))),
              }));
            })
            .catch(console.error);
        }
      },

      importFile: (name, content, parentId) => {
        // 尝试从第一行提取标题
        const lines = content.split('\n');
        let title = name;
        if (lines.length > 0 && lines[0].trim()) {
            title = lines[0].trim().replace(/^#+\s*/, '').substring(0, 50); // 去除md标题符号，限制长度
        }
        
        const format = name.endsWith('.md') ? 'md' : 'txt';
        
        const newFile: FileItem = {
          id: uuidv4(),
          parentId,
          name: title || name,
          type: 'file',
          content,
          format,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ items: normalizeItems([...state.items, newFile]), activeFileId: newFile.id }));
        if (get().token) {
          void fileApi
            .upsert(newFile)
            .then((serverItem: any) => {
              set((state) => ({
                items: normalizeItems(state.items.map((i) => (i.id === serverItem.id ? { ...i, ...serverItem } : i))),
              }));
            })
            .catch(console.error);
        }
      },

      convertFileFormat: (id, targetFormat) => {
        const existing = get().items.find((f) => f.id === id);
        if (!existing || existing.type !== 'file') return;
        const next: any = { ...existing, format: targetFormat, updatedAt: Date.now() };
        set((state) => ({
          items: normalizeItems(state.items.map((f) => (f.id === id ? next : f))),
        }));
        if (get().token) {
          void fileApi
            .upsert(next)
            .then((serverItem: any) => {
              set((state) => ({
                items: normalizeItems(state.items.map((i) => (i.id === serverItem.id ? { ...i, ...serverItem } : i))),
              }));
            })
            .catch(console.error);
        }
      },

      setActiveFile: (id) => set({ activeFileId: id }),

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        }));

        if (!get().token) return;
        const hasStorageChange =
          Object.prototype.hasOwnProperty.call(newSettings, 'storageType') ||
          Object.prototype.hasOwnProperty.call(newSettings, 's3Config') ||
          Object.prototype.hasOwnProperty.call(newSettings, 'webDavConfig');
        if (!hasStorageChange) return;

        if (storageConfigTimer) clearTimeout(storageConfigTimer);
        storageConfigTimer = setTimeout(() => {
          const s = get().settings;
          void storageApi.update({
            storageType: s.storageType,
            s3Config: s.s3Config,
            webDavConfig: s.webDavConfig,
          }, { silent: true }).catch(() => undefined);
        }, 600);
      },

      updateUserAvatar: (avatar) => {
        set((state) => ({
            user: state.user ? { ...state.user, avatar } : null
        }));
      },

      login: (user, token) => {
        set({ user, token });
        void storageApi.get()
          .then((cfg) => {
            if (!cfg) return;
            set((state) => ({
              settings: {
                ...state.settings,
                storageType: cfg.storageType ?? state.settings.storageType,
                s3Config: { ...state.settings.s3Config, ...(cfg.s3Config || {}) },
                webDavConfig: { ...state.settings.webDavConfig, ...(cfg.webDavConfig || {}) },
              }
            }));
          })
          .catch(() => undefined);
      },
      logout: () => set({ user: null, token: null }),
    }),
    {
      name: 'betterwriter-storage-v2', // New storage key for schema change
      version: 3,
      partialize: (state) => ({ items: state.items, activeFileId: state.activeFileId, settings: state.settings, user: state.user, token: state.token }),
      migrate: (persistedState: any) => {
        if (!persistedState || !Array.isArray(persistedState.items)) return persistedState;
        const idMap = new Map<string, string>();
        for (const it of persistedState.items) {
          if (it?.id === '1') idMap.set('1', uuidv4());
        }
        if (idMap.size === 0) return persistedState;
        const mapId = (v: any) => (v && idMap.has(v) ? idMap.get(v) : v);
        const items = persistedState.items.map((it: any) => ({
          ...it,
          id: mapId(it.id),
          parentId: mapId(it.parentId),
        }));
        return {
          ...persistedState,
          items,
          activeFileId: mapId(persistedState.activeFileId),
        };
      },
      merge: (persistedState, currentState) => {
        const merged: AppState = { ...currentState, ...(persistedState || {}) } as AppState;
        merged.items = normalizeItems(merged.items);
        return merged;
      },
    }
  )
);
