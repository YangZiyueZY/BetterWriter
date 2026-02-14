import fs from 'fs/promises';
import path from 'path';
import { resolveRelativePath, toNotesMirrorPath } from './syncPaths';

export const getLocalMirrorBaseDir = (): string => {
  return path.resolve(process.cwd(), '..', 'BetterWriter');
};

const resolveInside = (baseDir: string, targetPath: string): string => {
  const resolved = path.resolve(baseDir, targetPath);
  const rel = path.relative(baseDir, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Invalid path');
  }
  return resolved;
};

const ensureDir = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
};

export const mirrorUpsert = async (userId: number, file: any): Promise<void> => {
  const baseDir = getLocalMirrorBaseDir();
  const rel = await resolveRelativePath(userId, file);
  const localPath = toNotesMirrorPath(baseDir, userId, rel);
  const safeLocalPath = resolveInside(baseDir, localPath);

  if (file.type === 'folder') {
    await ensureDir(safeLocalPath);
    await fs
      .writeFile(path.join(safeLocalPath, '.bwmeta.json'), JSON.stringify({ id: String(file.id), type: 'folder' }), 'utf8')
      .catch(() => undefined);
    return;
  }

  await ensureDir(path.dirname(safeLocalPath));
  await fs.writeFile(safeLocalPath, typeof file.content === 'string' ? file.content : '', 'utf8');
  await fs
    .writeFile(
      `${safeLocalPath}.bwmeta.json`,
      JSON.stringify({ id: String(file.id), type: 'file', format: file.format === 'md' ? 'md' : 'txt' }),
      'utf8'
    )
    .catch(() => undefined);
};

export const mirrorDeleteRelative = async (userId: number, rel: string): Promise<void> => {
  const baseDir = getLocalMirrorBaseDir();
  const cleaned = rel.replace(/^\/+/, '');
  const segs = cleaned.split('/').filter(Boolean);
  if (segs.some((s) => s === '.' || s === '..')) {
    throw new Error('Invalid path');
  }
  const localPath = toNotesMirrorPath(baseDir, userId, cleaned);
  const safeLocalPath = resolveInside(baseDir, localPath);
  try {
    const stat = await fs.stat(safeLocalPath);
    if (stat.isDirectory()) {
      await fs.rm(safeLocalPath, { recursive: true, force: true });
    } else {
      await fs.rm(safeLocalPath, { force: true });
      await fs.rm(`${safeLocalPath}.bwmeta.json`, { force: true }).catch(() => undefined);
    }
  } catch {
  }
};

export const mirrorDelete = async (userId: number, fileId: string): Promise<void> => {
  const baseDir = getLocalMirrorBaseDir();
  const legacyUserDir = path.join(baseDir, String(userId));
  const candidates = [
    resolveInside(legacyUserDir, `${fileId}.md`),
    resolveInside(legacyUserDir, `${fileId}.txt`),
    resolveInside(legacyUserDir, fileId),
  ];
  await Promise.all(
    candidates.map(async (p) => {
      try {
        const stat = await fs.stat(p);
        if (stat.isDirectory()) await fs.rm(p, { recursive: true, force: true });
        else await fs.rm(p, { force: true });
      } catch {
      }
    })
  );
};
