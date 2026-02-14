type ClientLogLevel = 'error' | 'warn' | 'info' | 'debug';

export type ClientLogEntry = {
  ts: number;
  level: ClientLogLevel;
  msg: string;
};

const logs: ClientLogEntry[] = [];
const listeners = new Set<() => void>();
let inited = false;

const toMsg = (args: any[]): string =>
  args
    .map((a) => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');

const push = (level: ClientLogLevel, msg: string) => {
  logs.push({ ts: Date.now(), level, msg });
  if (logs.length > 2000) logs.splice(0, logs.length - 2000);
  for (const l of listeners) l();
};

export const initClientLogger = () => {
  if (inited) return;
  inited = true;

  const originals = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug ? console.debug.bind(console) : console.log.bind(console),
  };

  console.log = (...args: any[]) => {
    originals.log(...args);
    push('info', toMsg(args));
  };
  console.info = (...args: any[]) => {
    originals.info(...args);
    push('info', toMsg(args));
  };
  console.warn = (...args: any[]) => {
    originals.warn(...args);
    push('warn', toMsg(args));
  };
  console.error = (...args: any[]) => {
    originals.error(...args);
    push('error', toMsg(args));
  };
  console.debug = (...args: any[]) => {
    originals.debug(...args);
    push('debug', toMsg(args));
  };
};

export const getClientLogs = (): ClientLogEntry[] => logs.slice().sort((a, b) => b.ts - a.ts);

export const clearClientLogs = () => {
  logs.splice(0, logs.length);
  for (const l of listeners) l();
};

export const subscribeClientLogs = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
