import path from 'path';
import File from '../models/File';

const INVALID_WIN_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

export const sanitizeSegment = (raw: string): string => {
  const s = String(raw ?? '').trim().replace(INVALID_WIN_CHARS, '_');
  const noTrailingDots = s.replace(/[. ]+$/g, '');
  const safe = noTrailingDots || '未命名';
  return safe.length > 80 ? safe.slice(0, 80) : safe;
};

const isFolder = (f: any) => f?.type === 'folder';
const isFile = (f: any) => f?.type === 'file';

const normalizeExt = (format: unknown): 'md' | 'txt' => (format === 'md' ? 'md' : 'txt');

const ensureUniqueSegment = (desired: string, existingLower: Set<string>) => {
  const base = desired;
  if (!existingLower.has(base.toLocaleLowerCase())) return base;
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `${base} (${i})`;
    if (!existingLower.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return `${base} (999)`;
};

const stripDuplicateExt = (name: string, ext: 'md' | 'txt') => {
  const lower = name.toLocaleLowerCase();
  const suffix = `.${ext}`;
  if (lower.endsWith(suffix)) return name.slice(0, name.length - suffix.length);
  return name;
};

const uniqueFolderName = async (userId: number, parentId: string | null, folderName: string, selfId: string) => {
  const siblings = await File.findAll({ where: { userId, parentId, type: 'folder' } as any });
  const existing = new Set(
    siblings
      .filter((s: any) => String(s.getDataValue('id')) !== selfId)
      .map((s: any) => String(s.getDataValue('name') || '').toLocaleLowerCase())
  );
  return ensureUniqueSegment(folderName, existing);
};

const uniqueFileName = async (userId: number, parentId: string | null, baseName: string, ext: 'md' | 'txt', selfId: string) => {
  const siblings = await File.findAll({ where: { userId, parentId, type: 'file' } as any });
  const existing = new Set(
    siblings
      .filter((s: any) => String(s.getDataValue('id')) !== selfId)
      .map((s: any) => {
        const n = sanitizeSegment(String(s.getDataValue('name') || ''));
        const e = normalizeExt(s.getDataValue('format'));
        const stem = stripDuplicateExt(n, e);
        return `${stem}.${e}`.toLocaleLowerCase();
      })
  );
  const desiredStem = stripDuplicateExt(baseName, ext);
  const desiredFileName = `${desiredStem}.${ext}`;
  if (!existing.has(desiredFileName.toLocaleLowerCase())) return desiredFileName;
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `${desiredStem} (${i}).${ext}`;
    if (!existing.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return `${desiredStem} (999).${ext}`;
};

export const resolveFolderSegments = async (userId: number, folderId: string | null): Promise<string[]> => {
  const segments: string[] = [];
  let current: string | null = folderId;
  const guard = new Set<string>();
  while (current) {
    if (guard.has(current)) break;
    guard.add(current);
    const f: any = await File.findOne({ where: { id: current, userId } });
    if (!f || !isFolder(f)) break;
    const name = sanitizeSegment(String(f.getDataValue('name') || '未命名'));
    segments.push(name);
    current = f.getDataValue('parentId') ? String(f.getDataValue('parentId')) : null;
  }
  return segments.reverse();
};

export const resolveRelativePath = async (userId: number, item: any): Promise<string> => {
  const id = String(item.getDataValue ? item.getDataValue('id') : item.id);
  const parentId = item.getDataValue ? (item.getDataValue('parentId') ? String(item.getDataValue('parentId')) : null) : (item.parentId ?? null);
  const nameRaw = item.getDataValue ? String(item.getDataValue('name') || '') : String(item.name || '');
  const safeName = sanitizeSegment(nameRaw);
  const folderSegments = await resolveFolderSegments(userId, parentId);

  if (isFolder(item)) {
    const folderName = await uniqueFolderName(userId, parentId, safeName, id);
    return path.posix.join(...folderSegments.map(sanitizeSegment), folderName);
  }

  const ext = normalizeExt(item.getDataValue ? item.getDataValue('format') : item.format);
  const fileName = await uniqueFileName(userId, parentId, safeName, ext, id);
  return path.posix.join(...folderSegments.map(sanitizeSegment), fileName);
};

export const toNotesRemoteKey = (userId: number, rel: string) => {
  const cleaned = rel.replace(/^\/+/, '');
  return `${userId}/notes/${cleaned}`;
};

export const toNotesMirrorPath = (baseDir: string, userId: number, rel: string) => {
  const cleaned = rel.replace(/^\/+/, '');
  const parts = cleaned.split('/').filter(Boolean);
  return path.join(baseDir, String(userId), ...parts);
};
