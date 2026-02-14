import { describe, expect, it, vi } from 'vitest';

const startLoading = vi.fn(() => 'tok');
const stopLoading = vi.fn();

vi.mock('../lib/loadingManager', () => ({
  startLoading,
  stopLoading,
}));

describe('api loading interceptor', () => {
  it('skips global loading when __bwSkipLoading is set', async () => {
    const mod = await import('../services/api');
    const api: any = mod.default;

    const reqHandler = api.interceptors.request.handlers[0].fulfilled;
    await reqHandler({ headers: {} });
    expect(startLoading).toHaveBeenCalledTimes(1);

    await reqHandler({ headers: {}, __bwSkipLoading: true });
    expect(startLoading).toHaveBeenCalledTimes(1);
  }, 20000);

  it('stops loading token on response', async () => {
    const mod = await import('../services/api');
    const api: any = mod.default;
    const resHandler = api.interceptors.response.handlers[0].fulfilled;

    await resHandler({ config: { __bwLoadingToken: 'tok' } });
    expect(stopLoading).toHaveBeenCalledWith('tok');
  }, 20000);
});
