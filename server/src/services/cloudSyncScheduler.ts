import StorageConfig from '../models/StorageConfig';
import { isUserSyncRunning } from './syncQueue';
import { reconcileUserCloud } from './cloudReconciler';

let timer: ReturnType<typeof setInterval> | null = null;

export const startCloudSyncScheduler = () => {
  if (timer) return;
  timer = setInterval(() => {
    void (async () => {
      const cfgs: any[] = await StorageConfig.findAll();
      for (const c of cfgs) {
        const type = String(c.getDataValue('storageType') || 'local');
        if (type !== 's3' && type !== 'webdav') continue;
        const userId = Number(c.getDataValue('userId'));
        if (!Number.isFinite(userId)) continue;
        if (isUserSyncRunning(userId)) continue;
        void reconcileUserCloud(userId).catch(() => undefined);
      }
    })().catch(() => undefined);
  }, 20_000);
};
