import { describe, expect, it, vi } from 'vitest';
import { configureLoading, getLoadingState, resetLoading, startLoading, stopLoading } from '../lib/loadingManager';

describe('loadingManager', () => {
  it('delays showing and enforces min show time', async () => {
    vi.useFakeTimers();
    resetLoading();
    configureLoading({ delayShowMs: 100, minShowMs: 200 });

    const t = startLoading();
    expect(getLoadingState().visible).toBe(false);

    await vi.advanceTimersByTimeAsync(110);
    expect(getLoadingState().visible).toBe(true);

    stopLoading(t);
    expect(getLoadingState().visible).toBe(true);

    await vi.advanceTimersByTimeAsync(150);
    expect(getLoadingState().visible).toBe(true);

    await vi.advanceTimersByTimeAsync(80);
    expect(getLoadingState().visible).toBe(false);
    vi.useRealTimers();
  });

  it('stays visible while multiple tokens pending', async () => {
    vi.useFakeTimers();
    resetLoading();
    configureLoading({ delayShowMs: 0, minShowMs: 0 });

    const a = startLoading();
    const b = startLoading();
    await vi.advanceTimersByTimeAsync(0);
    expect(getLoadingState().visible).toBe(true);
    expect(getLoadingState().pendingCount).toBe(2);

    stopLoading(a);
    await vi.advanceTimersByTimeAsync(0);
    expect(getLoadingState().visible).toBe(true);
    expect(getLoadingState().pendingCount).toBe(1);

    stopLoading(b);
    await vi.advanceTimersByTimeAsync(0);
    expect(getLoadingState().visible).toBe(false);
    expect(getLoadingState().pendingCount).toBe(0);
    vi.useRealTimers();
  });
});

