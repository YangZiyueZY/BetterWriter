import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { v4 as uuidv4 } from 'uuid';

interface MermaidProps {
  chart: string;
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'inherit',
});

export const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const idRef = useRef(`mermaid-${uuidv4()}`);

  useEffect(() => {
    const renderChart = async () => {
      if (!containerRef.current || !chart) return;
      
      try {
        setError('');
        // Mermaid requires a unique ID for each chart
        const { svg: svgContent } = await mermaid.render(idRef.current, chart);
        setSvg(svgContent);
      } catch (err: any) {
        console.error('Mermaid render error:', err);
        setError('语法错误: ' + err.message);
      }
    };

    renderChart();
  }, [chart]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-mono border border-red-200 dark:border-red-900/50">
        {error}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="mermaid-chart flex justify-center py-4 overflow-x-auto bg-slate-50 dark:bg-slate-900/50 rounded-lg my-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
