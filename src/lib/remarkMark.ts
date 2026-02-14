type Node = {
  type?: string;
  value?: unknown;
  children?: Node[];
  [k: string]: unknown;
};

const shouldSkip = (node: Node) => {
  const t = node?.type;
  return t === 'code' || t === 'inlineCode' || t === 'math' || t === 'inlineMath';
};

const splitMark = (value: string): Node[] | null => {
  if (!value.includes('==')) return null;
  const out: Node[] = [];
  const re = /==(.+?)==/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    const start = m.index;
    const end = start + m[0].length;
    const inner = m[1];
    const prev = start > 0 ? value[start - 1] : '';
    const next = end < value.length ? value[end] : '';
    const skip = prev === '=' || next === '=' || inner.startsWith('=') || inner.endsWith('=');
    if (skip) {
      if (start > last) out.push({ type: 'text', value: value.slice(last, start) });
      out.push({ type: 'text', value: m[0] });
      last = end;
      continue;
    }
    if (start > last) out.push({ type: 'text', value: value.slice(last, start) });
    if (inner && inner.trim().length > 0) out.push({ type: 'mark', children: [{ type: 'text', value: inner }] });
    else out.push({ type: 'text', value: m[0] });
    last = end;
  }
  if (out.length === 0) return null;
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
  return out;
};

const transform = (node: Node) => {
  if (!node || typeof node !== 'object') return;
  if (shouldSkip(node)) return;
  const children = node.children;
  if (!Array.isArray(children) || children.length === 0) return;
  const next: Node[] = [];
  let changed = false;
  for (const c of children) {
    if (c?.type === 'text' && typeof c.value === 'string') {
      const split = splitMark(c.value);
      if (split) {
        next.push(...split);
        changed = true;
        continue;
      }
    }
    next.push(c);
  }
  const outChildren = changed ? next : children;
  if (changed) node.children = outChildren;
  for (const c of outChildren) transform(c);
};

export const remarkMark = () => (tree: Node) => {
  transform(tree);
};
