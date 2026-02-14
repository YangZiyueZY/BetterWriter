import React, { useEffect, useMemo, useState } from 'react';

export const Graphviz: React.FC<{ dot: string }> = ({ dot }) => {
  const normalized = useMemo(() => String(dot || '').replace(/\n$/, ''), [dot]);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setSvg('');
    setError('');
    if (!normalized.trim()) return;

    (async () => {
      try {
        const mod = (await import('@viz-js/viz')) as unknown;
        const vizFactory = (mod as { default: () => Promise<{ renderString: (dot: string, opts: { format: string; engine: string }) => Promise<string> }> }).default;
        const viz = await vizFactory();
        const out: string = await viz.renderString(normalized, { format: 'svg', engine: 'dot' });
        if (!cancelled) setSvg(out);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normalized]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-mono border border-red-200 dark:border-red-900/50">
        语法错误: {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 rounded-lg text-sm font-mono border border-slate-200/60 dark:border-slate-800/60">
        正在渲染…
      </div>
    );
  }

  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return (
    <div data-bw-block="graphviz" className="flex justify-center py-4 overflow-x-auto bg-slate-50 dark:bg-slate-900/50 rounded-lg my-4">
      <img alt="graphviz" src={src} />
    </div>
  );
};
