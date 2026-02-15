import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface MermaidProps {
  chart: string;
}

type MermaidApi = {
  initialize: (cfg: { startOnLoad: boolean; theme: string; securityLevel: string; fontFamily: string }) => void;
  render: (id: string, chart: string) => Promise<{ svg: string }>;
  parse?: (chart: string) => Promise<boolean>;
};

export const Mermaid: React.FC<MermaidProps> = React.memo(({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const idRef = useRef(`mermaid-${uuidv4()}`);
  const initRef = useRef(false);
  const lastChartRef = useRef<string>('');

  useEffect(() => {
    if (chart === lastChartRef.current) return;
    lastChartRef.current = chart;

    let cancelled = false;

    const shouldIgnoreMermaidConsole = (args: unknown[]) => {
      for (const a of args) {
        if (typeof a === 'string') {
          if (/syntax error|parse error|mermaid/i.test(a)) return true;
          if (a.includes('<svg') && a.includes('mermaid')) return true;
        }
      }
      return false;
    };

    const suppressMermaidConsole = () => {
      const origError = console.error;
      const origWarn = console.warn;
      console.error = (...args: any[]) => {
        if (!shouldIgnoreMermaidConsole(args)) origError(...args);
      };
      console.warn = (...args: any[]) => {
        if (!shouldIgnoreMermaidConsole(args)) origWarn(...args);
      };
      return () => {
        console.error = origError;
        console.warn = origWarn;
      };
    };

    const renderChart = async () => {
      if (!containerRef.current || !chart) return;
      
      try {
        const mod = (await import('mermaid')) as unknown;
        const mermaid = ((mod as { default?: MermaidApi }).default ?? (mod as MermaidApi)) as MermaidApi;
        if (!initRef.current) {
          initRef.current = true;
          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            fontFamily: 'inherit',
          });
        }

        const restore = suppressMermaidConsole();
        let svgContent = '';
        try {
          const parseFn = (mermaid as MermaidApi).parse;
          if (typeof parseFn === 'function') {
            try {
              await parseFn(chart);
            } catch {}
          }
          const result = await mermaid.render(idRef.current, chart);
          svgContent = String((result as any)?.svg ?? '');
        } finally {
          restore();
        }

        if (cancelled) return;

        const bad = /aria-roledescription="error"|class="error-text"|syntax error in text|mermaid version/i.test(svgContent);
        if (bad) {
          setError('Mermaid 语法错误');
          return;
        }
        setError('');
        if (svgContent) setSvg(svgContent);
      } catch {
        if (cancelled) return;
        setError('Mermaid 渲染失败');
        return;
      }
    };

    void renderChart();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  return (
    <div 
      ref={containerRef}
      data-bw-block="mermaid"
      className="mermaid-chart flex flex-col items-center my-4 overflow-x-auto"
    >
      {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} className={error ? "opacity-50 transition-opacity duration-200" : "transition-opacity duration-200"} /> : null}
      {error ? <div className="mt-2 text-sm text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">{error}</div> : null}
    </div>
  );
});
