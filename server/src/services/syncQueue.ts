import File from '../models/File';
import { mirrorUpsert } from './localMirror';
import { syncUpsertToCloud } from './cloudSync';

const perUserChain = new Map<number, Promise<void>>();

export const enqueueFilesSync = (userId: number, files: any[]): void => {
  const prev = perUserChain.get(userId) || Promise.resolve();
  const next = prev
    .then(async () => {
      for (const f of files) {
        try {
          await mirrorUpsert(userId, f);
          await syncUpsertToCloud(userId, f);
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

export const enqueueFullSync = async (userId: number): Promise<number> => {
  const files = await File.findAll({ where: { userId } });
  enqueueFilesSync(userId, files);
  return files.length;
};

