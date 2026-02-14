import File from '../models/File';
import { mirrorUpsert } from './localMirror';
import { syncUpsertToCloud } from './cloudSync';

const perUserChain = new Map<number, Promise<void>>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const withRetry = async (fn: () => Promise<void>) => {
  let lastErr: any;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await fn();
      return;
    } catch (e: any) {
      lastErr = e;
      if (attempt < 3) await sleep(30_000);
    }
  }
  throw lastErr;
};

export const enqueueFilesSync = (userId: number, files: any[]): void => {
  const prev = perUserChain.get(userId) || Promise.resolve();
  const next = prev
    .then(async () => {
      for (const f of files) {
        try {
          await withRetry(async () => {
            await mirrorUpsert(userId, f);
            await syncUpsertToCloud(userId, f);
          });
        } catch {
        }
      }
    })
    .catch(() => undefined)
    .finally(() => {
      if (perUserChain.get(userId) === next) {
        perUserChain.delete(userId);
      }
    });
  perUserChain.set(userId, next);
};

export const isUserSyncRunning = (userId: number): boolean => {
  return perUserChain.has(userId);
};

export const enqueueFullSync = async (userId: number): Promise<number> => {
  const files = await File.findAll({ where: { userId } });
  enqueueFilesSync(userId, files);
  return files.length;
};

