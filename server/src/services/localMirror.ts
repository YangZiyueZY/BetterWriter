import fs from 'fs/promises';
import path from 'path';

export const getLocalMirrorBaseDir = (): string => {
  return path.resolve(process.cwd(), '..', 'BetterWriter');
};

const isSafeSegment = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  if (value.length < 1 || value.length > 128) return false;
  return /^[a-zA-Z0-9_-]+$/.test(value);
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
  const userDir = path.join(baseDir, String(userId));
  await ensureDir(userDir);

  if (!isSafeSegment(file?.id)) {
    throw new Error('Invalid file id');
  }

  if (file.type === 'folder') {
    const folderPath = resolveInside(userDir, file.id);
    await ensureDir(folderPath);
    return;
  }

  const ext = file.format === 'md' ? 'md' : 'txt';
  const filePath = resolveInside(userDir, `${file.id}.${ext}`);
  await fs.writeFile(filePath, typeof file.content === 'string' ? file.content : '', 'utf8');
};

export const mirrorDelete = async (userId: number, fileId: string): Promise<void> => {
  const baseDir = getLocalMirrorBaseDir();
  const userDir = path.join(baseDir, String(userId));
  if (!isSafeSegment(fileId)) {
    throw new Error('Invalid file id');
  }
  const candidates = [
    resolveInside(userDir, `${fileId}.md`),
    resolveInside(userDir, `${fileId}.txt`),
    resolveInside(userDir, fileId),
  ];

  await Promise.all(
    candidates.map(async (p) => {
      try {
        const stat = await fs.stat(p);
        if (stat.isDirectory()) {
          await fs.rm(p, { recursive: true, force: true });
        } else {
          await fs.rm(p, { force: true });
        }
      } catch {
        return;
      }
    })
  );
};
