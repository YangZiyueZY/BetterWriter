import fs from 'fs';
import path from 'path';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

type LogEntry = {
  ts: number;
  level: LogLevel;
  module: string;
  msg: string;
  meta?: any;
};

const logsDir = path.join(__dirname, '..', '..', 'logs');
let writeQueue: Promise<void> = Promise.resolve();

const dayKey = (ts: number): string => {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const logFilePath = (ts: number): string => path.join(logsDir, `app-${dayKey(ts)}.log`);

const ensureLogsDir = async (): Promise<void> => {
  await fs.promises.mkdir(logsDir, { recursive: true });
};

const appendLine = async (line: string, ts: number): Promise<void> => {
  await ensureLogsDir();
  await fs.promises.appendFile(logFilePath(ts), line, 'utf8');
};

export const log = (level: LogLevel, module: string, msg: string, meta?: any) => {
  const ts = Date.now();
  const entry: LogEntry = { ts, level, module, msg };
  if (meta !== undefined) entry.meta = meta;
  const line = `${JSON.stringify(entry)}\n`;
  writeQueue = writeQueue.then(() => appendLine(line, ts)).catch(() => undefined);
};

export const initLogRetention = async (keepDays: number): Promise<void> => {
  await ensureLogsDir();
  const files = await fs.promises.readdir(logsDir).catch(() => []);
  const now = Date.now();
  const cutoff = now - keepDays * 24 * 60 * 60 * 1000;
  await Promise.all(
    files
      .filter((f) => f.startsWith('app-') && f.endsWith('.log'))
      .map(async (f) => {
        const full = path.join(logsDir, f);
        const stat = await fs.promises.stat(full).catch(() => null as any);
        if (!stat) return;
        if (stat.mtimeMs < cutoff) {
          await fs.promises.unlink(full).catch(() => undefined);
        }
      })
  );
};

export const patchConsoleToFile = () => {
  const originals = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug ? console.debug.bind(console) : console.log.bind(console),
  };

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

  console.log = (...args: any[]) => {
    originals.log(...args);
    log('info', 'console', toMsg(args));
  };
  console.info = (...args: any[]) => {
    originals.info(...args);
    log('info', 'console', toMsg(args));
  };
  console.warn = (...args: any[]) => {
    originals.warn(...args);
    log('warn', 'console', toMsg(args));
  };
  console.error = (...args: any[]) => {
    originals.error(...args);
    log('error', 'console', toMsg(args));
  };
  console.debug = (...args: any[]) => {
    originals.debug(...args);
    log('debug', 'console', toMsg(args));
  };
};

export const getLogsDir = (): string => logsDir;
