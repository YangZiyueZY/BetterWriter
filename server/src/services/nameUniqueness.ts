import File from '../models/File';

const splitStemExt = (name: string) => {
  const m = String(name).match(/^(.*?)(\.(md|txt))$/i);
  if (m) return { stem: m[1], ext: m[2] };
  return { stem: String(name), ext: '' };
};

export const computeUniqueName = (desired: string, existingNames: string[]) => {
  const base = String(desired ?? '').trim() || '未命名';
  const lower = new Set(existingNames.map((n) => String(n || '').toLocaleLowerCase()));
  if (!lower.has(base.toLocaleLowerCase())) return base;

  const { stem, ext } = splitStemExt(base);
  const cleanStem = stem.trim() || '未命名';
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `${cleanStem} (${i})${ext}`;
    if (!lower.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return `${cleanStem} (999)${ext}`;
};

export const ensureUniqueNameInDb = async (params: {
  userId: number;
  parentId: string | null;
  type: 'file' | 'folder';
  desiredName: string;
  selfId: string;
}) => {
  const siblings = await File.findAll({ where: { userId: params.userId, parentId: params.parentId, type: params.type } as any });
  const existing = siblings
    .filter((s: any) => String(s.getDataValue('id')) !== params.selfId)
    .map((s: any) => String(s.getDataValue('name') || ''));
  return computeUniqueName(params.desiredName, existing);
};

