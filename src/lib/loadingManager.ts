export type LoadingTheme = {
  accentColor: string;
  backgroundColor: string;
  textColor: string;
};

export type LoadingConfig = {
  minShowMs: number;
  delayShowMs: number;
  slowHintMs: number;
  title: string;
  slowHintText: string;
  blockInteraction: boolean;
  theme: LoadingTheme;
};

export type LoadingState = {
  visible: boolean;
  pendingCount: number;
  title: string;
  shownAt: number | null;
  since: number | null;
  config: LoadingConfig;
};

type Listener = (s: LoadingState) => void;

const defaultConfig: LoadingConfig = {
  minShowMs: 250,
  delayShowMs: 120,
  slowHintMs: 3000,
  title: '正在加载…',
  slowHintText: '加载时间较长，请稍候…',
  blockInteraction: true,
  theme: {
    accentColor: '#3b82f6',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    textColor: '#0f172a',
  },
};

let config: LoadingConfig = defaultConfig;

let pendingCount = 0;
let visible = false;
let shownAt: number | null = null;
let since: number | null = null;
let title: string = config.title;

let showTimer: ReturnType<typeof setTimeout> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<Listener>();
const tokens = new Map<string, { title?: string }>();

const snapshot = (): LoadingState => ({
  visible,
  pendingCount,
  title,
  shownAt,
  since,
  config,
});

const emit = () => {
  const s = snapshot();
  for (const l of listeners) l(s);
};

const recomputeTitle = () => {
  for (const [, v] of tokens) {
    if (v.title) {
      title = v.title;
      return;
    }
  }
  title = config.title;
};

const clearTimers = () => {
  if (showTimer) clearTimeout(showTimer);
  if (hideTimer) clearTimeout(hideTimer);
  showTimer = null;
  hideTimer = null;
};

const requestShow = () => {
  if (visible) return;
  if (showTimer) return;
  showTimer = setTimeout(() => {
    showTimer = null;
    if (pendingCount <= 0) return;
    visible = true;
    const now = Date.now();
    shownAt = now;
    if (!since) since = now;
    emit();
  }, Math.max(0, config.delayShowMs));
};

const requestHide = () => {
  if (!visible) {
    shownAt = null;
    since = null;
    title = config.title;
    emit();
    return;
  }

  const now = Date.now();
  const keepMs = shownAt ? Math.max(0, config.minShowMs - (now - shownAt)) : config.minShowMs;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    hideTimer = null;
    if (pendingCount > 0) return;
    visible = false;
    shownAt = null;
    since = null;
    title = config.title;
    emit();
  }, keepMs);
};

export const configureLoading = (next: Partial<LoadingConfig>) => {
  config = {
    ...config,
    ...next,
    theme: { ...config.theme, ...(next.theme || {}) },
  };
  if (!title) title = config.title;
  emit();
};

export const getLoadingState = (): LoadingState => snapshot();

export const subscribeLoading = (listener: Listener) => {
  listeners.add(listener);
  listener(snapshot());
  return () => {
    listeners.delete(listener);
  };
};

export const startLoading = (opts?: { title?: string }) => {
  const token = (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random()}`);
  tokens.set(token, { title: opts?.title });
  pendingCount += 1;
  if (!since) since = Date.now();
  recomputeTitle();
  clearTimers();
  requestShow();
  emit();
  return token;
};

export const stopLoading = (token?: string) => {
  if (token && tokens.has(token)) {
    tokens.delete(token);
  }
  pendingCount = Math.max(0, pendingCount - 1);
  recomputeTitle();
  clearTimers();
  if (pendingCount > 0) {
    requestShow();
  } else {
    requestHide();
  }
  emit();
};

export const resetLoading = () => {
  tokens.clear();
  pendingCount = 0;
  visible = false;
  shownAt = null;
  since = null;
  title = config.title;
  clearTimers();
  emit();
};

