import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import File from '../models/File';
import { getLocalMirrorBaseDir, mirrorUpsert, mirrorDeleteRelative } from './localMirror';
import { syncDeleteRelativeFromCloud, syncUpsertToCloud } from './cloudSync';
import { sanitizeSegment } from './syncPaths';

const isNotesFile = (p: string) => p.endsWith('.md') || p.endsWith('.txt');

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

const ensureFolderPath = async (userId: number, segments: string[]) => {
  let parentId: string | null = null;
  for (const seg of segments) {
    const name = sanitizeSegment(seg);
    const existing: any = await File.findOne({ where: { userId, parentId, type: 'folder', name } });
    if (existing) {
      parentId = String(existing.getDataValue('id'));
      continue;
    }
    const id = crypto.randomUUID();
    await File.create({
      id,
      userId,
      parentId,
      name,
      type: 'folder',
      content: null,
      format: null,
      updatedAt: Date.now(),
    } as any);
    parentId = id;
  }
  return parentId;
};

const upsertFromDisk = async (absPath: string) => {
  const base = getLocalMirrorBaseDir();
  const rel = path.relative(base, absPath);
  const parts = rel.split(path.sep).filter(Boolean);
  if (parts.length < 2) return;
  const userId = Number(parts[0]);
  if (!Number.isFinite(userId)) return;

  const relParts = parts.slice(1);
  const dirParts = relParts.slice(0, -1);
  const filename = relParts[relParts.length - 1];
  if (!filename) return;
  const ext = filename.toLowerCase().endsWith('.md') ? 'md' : 'txt';
  const rawBase = filename.replace(/\.(md|txt)$/i, '');
  const name = sanitizeSegment(rawBase);

  const parentId = await ensureFolderPath(userId, dirParts);

  const metaPath = `${absPath}.bwmeta.json`;
  let fileId: string | null = null;
  try {
    const metaRaw = await fs.readFile(metaPath, 'utf8');
    const meta = JSON.parse(metaRaw);
    if (meta?.id) fileId = String(meta.id);
  } catch {
  }

  const content = await fs.readFile(absPath, 'utf8').catch(() => '');

  if (fileId) {
    const existing: any = await File.findOne({ where: { id: fileId, userId } });
    if (existing) {
      const prev = String(existing.getDataValue('content') || '');
      const prevName = String(existing.getDataValue('name') || '');
      const prevParent = existing.getDataValue('parentId') ? String(existing.getDataValue('parentId')) : null;
      const prevFormat = existing.getDataValue('format') === 'md' ? 'md' : 'txt';
      if (prev === content && prevName === name && prevParent === parentId && prevFormat === ext) return;
      const serverUpdatedAt = Number(existing.getDataValue('updatedAt') || 0);
      const now = Date.now();
      if (prev !== content && serverUpdatedAt && now - serverUpdatedAt < 60_000) {
        const conflictId = crypto.randomUUID();
        const conflictName = `${name}-冲突-本地-${now}`;
        const conflict: any = await File.create({
          id: conflictId,
          userId,
          parentId,
          name: conflictName,
          type: 'file',
          content,
          format: ext,
          updatedAt: now,
        } as any);
        await withRetry(async () => {
          await mirrorUpsert(userId, conflict);
          await syncUpsertToCloud(userId, conflict);
        }).catch(() => undefined);
        return;
      }
      existing.setDataValue('name', name);
      existing.setDataValue('parentId', parentId);
      existing.setDataValue('format', ext);
      existing.setDataValue('content', content);
      existing.setDataValue('updatedAt', Date.now());
      await existing.save();
      await withRetry(async () => {
        await mirrorUpsert(userId, existing);
        await syncUpsertToCloud(userId, existing);
      });
      return;
    }
  }

  const id = crypto.randomUUID();
  const created: any = await File.create({
    id,
    userId,
    parentId,
    name,
    type: 'file',
    content,
    format: ext,
    updatedAt: Date.now(),
  } as any);
  await withRetry(async () => {
    await mirrorUpsert(userId, created);
    await syncUpsertToCloud(userId, created);
  });
};

const deleteFromDisk = async (absPath: string) => {
  const base = getLocalMirrorBaseDir();
  const rel = path.relative(base, absPath);
  const parts = rel.split(path.sep).filter(Boolean);
  if (parts.length < 2) return;
  const userId = Number(parts[0]);
  if (!Number.isFinite(userId)) return;
  const relParts = parts.slice(1);
  const relPosix = relParts.join('/').replace(/\\/g, '/');
  const metaPath = `${absPath}.bwmeta.json`;
  try {
    const metaRaw = await fs.readFile(metaPath, 'utf8');
    const meta = JSON.parse(metaRaw);
    const id = meta?.id ? String(meta.id) : null;
    if (id) {
      await File.destroy({ where: { id, userId } }).catch(() => undefined);
    }
  } catch {
  }
  await withRetry(async () => {
    await mirrorDeleteRelative(userId, relPosix);
    await syncDeleteRelativeFromCloud(userId, relPosix);
  }).catch(() => undefined);
};

export const startMirrorWatcher = () => {
  const baseDir = getLocalMirrorBaseDir();
  const watcher = chokidar.watch(baseDir, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    ignored: (p) => p.endsWith('.bwmeta.json') || p.endsWith('.keep'),
  });

  watcher.on('add', (p) => {
    if (!isNotesFile(p)) return;
    void upsertFromDisk(p).catch(() => undefined);
  });
  watcher.on('change', (p) => {
    if (!isNotesFile(p)) return;
    void upsertFromDisk(p).catch(() => undefined);
  });
  watcher.on('unlink', (p) => {
    if (!isNotesFile(p)) return;
    void deleteFromDisk(p).catch(() => undefined);
  });
};
