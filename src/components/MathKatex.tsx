import React, { useEffect, useMemo, useState } from 'react';

interface MathKatexProps {
  value: string;
  displayMode: boolean;
}

export const MathKatex: React.FC<MathKatexProps> = ({ value, displayMode }) => {
  const normalized = useMemo(() => value.replace(/\n$/, ''), [value]);
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setHtml('');
    setError('');

    (async () => {
      try {
        const mod: any = await import('katex/dist/katex.mjs');
        const katex = mod?.default ?? mod;
        if (typeof katex?.renderToString !== 'function') {
          throw new Error('KaTeX module did not provide renderToString');
        }
        const rendered = katex.renderToString(normalized, {
          displayMode,
          throwOnError: false,
          strict: 'ignore',
        });
        if (!cancelled) setHtml(rendered);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normalized, displayMode]);

  if (error) {
    return (
      <code className="text-red-500 dark:text-red-400">
        {normalized}
      </code>
    );
  }

  if (!html) {
    return (
      <code className="text-slate-500 dark:text-slate-400">
        {normalized}
      </code>
    );
  }

  if (displayMode) {
    return <div className="my-4 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
};

