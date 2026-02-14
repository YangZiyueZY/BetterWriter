import React, { useEffect, useMemo, useState } from 'react';

type Props = {
  language?: string;
  value: string;
};

type PrismHighlighter = React.ComponentType<any>;

export const CodeBlock: React.FC<Props> = ({ language, value }) => {
  const [Highlighter, setHighlighter] = useState<PrismHighlighter | null>(null);
  const [style, setStyle] = useState<any>(null);

  const shouldHighlight = useMemo(() => value.length <= 60_000, [value.length]);

  useEffect(() => {
    if (!shouldHighlight) return;
    let cancelled = false;
    const load = async () => {
      const mod = await import('react-syntax-highlighter');
      const prism = (mod as any).Prism ?? (mod as any).Light;
      const styleMod = await import('react-syntax-highlighter/dist/esm/styles/prism');
      const oneDark = (styleMod as any).oneDark ?? (styleMod as any).atomDark;
      if (cancelled) return;
      setHighlighter(() => prism);
      setStyle(oneDark);
    };
    void load().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [shouldHighlight]);

  if (!shouldHighlight || !Highlighter || !style) {
    return (
      <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 overflow-x-auto text-xs leading-relaxed">
        <code className={language ? `language-${language}` : undefined}>{value}</code>
      </pre>
    );
  }

  return (
    <Highlighter language={language} style={style} PreTag="div" customStyle={{ margin: 0, borderRadius: 12, fontSize: 12 }}>
      {value}
    </Highlighter>
  );
};

