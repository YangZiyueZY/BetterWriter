import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('uuid', () => ({
  v4: () => 'fixed-id',
}));

const upsert = vi.fn(async (item: any) => ({ ...item, name: '测试 (1).md', updatedAt: 123 }));

vi.mock('../services/api', () => ({
  fileApi: {
    upsert,
    delete: vi.fn(),
    getOne: vi.fn(),
    getAll: vi.fn(),
  },
  storageApi: {
    update: vi.fn(),
    get: vi.fn(),
    test: vi.fn(),
    syncNow: vi.fn(),
  },
}));

describe('文件命名一致性（前端合并服务端结果）', () => {
  it('创建文件后以服务端返回的重名规则为准', async () => {
    const mod = await import('../store/useStore');
    const store = mod.useStore;
    store.setState({
      items: [],
      activeFileId: null,
      sidebarOpen: true,
      settings: store.getState().settings,
      user: { id: 1, username: 'u' },
      token: 'tok',
    } as any);

    store.getState().addFile('测试.md', 'md', null);

    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
    const item = store.getState().items.find((i: any) => i.id === 'fixed-id');
    expect(item).toBeTruthy();
    expect(item?.name).toBe('测试 (1).md');
  }, 20000);
});
