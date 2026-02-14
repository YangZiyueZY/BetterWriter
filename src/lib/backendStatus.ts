export type BackendStatus = {
  down: boolean;
  since: number | null;
  message: string | null;
};

let state: BackendStatus = { down: false, since: null, message: null };
const listeners = new Set<(s: BackendStatus) => void>();

const emit = () => {
  const snapshot = { ...state };
  for (const l of listeners) l(snapshot);
};

export const getBackendStatus = (): BackendStatus => ({ ...state });

export const setBackendDown = (message?: string) => {
  if (!state.down) {
    state = { down: true, since: Date.now(), message: message || '无法连接到后端服务' };
    emit();
    return;
  }
  if (message && message !== state.message) {
    state = { ...state, message };
    emit();
  }
};

export const setBackendUp = () => {
  if (!state.down) return;
  state = { down: false, since: null, message: null };
  emit();
};

export const subscribeBackendStatus = (listener: (s: BackendStatus) => void) => {
  listeners.add(listener);
  listener({ ...state });
  return () => {
    listeners.delete(listener);
  };
};

