import React, { useEffect, useMemo, useRef, useState } from 'react';

interface MathKatexProps {
  value: string;
  displayMode: boolean;
}

type KatexApi = {
  renderToString: (value: string, opts: { displayMode: boolean; throwOnError: boolean; strict: 'ignore' }) => string;
};

let katexCssLoaded = false;
let katexPromise: Promise<KatexApi> | null = null;

const loadKatex = async () => {
  if (!katexPromise) {
    katexPromise = (async () => {
      if (!katexCssLoaded) {
        katexCssLoaded = true;
        try {
          await import('katex/dist/katex.min.css');
        } catch (e) {
          console.warn('Failed to load KaTeX CSS:', e);
        }
      }
      
      let mod: any;
      try {
        mod = await import('katex');
      } catch (e) {
        console.warn('Standard import failed, trying direct path:', e);
        mod = await import('katex/dist/katex.mjs');
      }
      
      return (mod.default || mod) as KatexApi;
    })();
  }
  return katexPromise;
};

export const MathKatex: React.FC<MathKatexProps> = ({ value, displayMode }) => {
  const normalized = useMemo(() => value.replace(/\n$/, ''), [value]);
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string>('');
  const lastHtmlRef = useRef<string>('');

  useEffect(() => {
    lastHtmlRef.current = html;
  }, [html]);

  useEffect(() => {
    let cancelled = false;
    setError('');

    (async () => {
      try {
        const katex = await loadKatex();
        if (typeof katex?.renderToString !== 'function') {
          throw new Error('KaTeX module did not provide renderToString');
        }
        const rendered = katex.renderToString(normalized, {
          displayMode,
          throwOnError: false,
          strict: 'ignore',
        });
        if (!cancelled) setHtml(rendered);
      } catch (e) {
        if (!cancelled) {
          setHtml(lastHtmlRef.current);
          setError(e instanceof Error ? e.message : String(e));
        }
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
    return <div data-bw-block="math" className="my-4 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
};
