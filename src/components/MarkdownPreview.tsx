import React, { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import { Mermaid } from './Mermaid';
import { MathKatex } from './MathKatex';
import { CodeBlock } from './CodeBlock';
import { Graphviz } from './Graphviz';
import { sanitizeHref, sanitizeImageSrc } from '../lib/security';
import { remarkMark } from '../lib/remarkMark';
import type { Settings } from '../types';

const resolvePlugin = (plugin: any) => (plugin && typeof plugin.default === 'function' ? plugin.default : plugin);

export const MarkdownPreview: React.FC<{ content: string; settings: Settings }> = ({ content, settings }) => {
  const urlTransform = (url: string, key: string) => {
    if (key === 'src') return sanitizeImageSrc(url);
    return sanitizeHref(url);
  };

  const toText = (children: any) => {
    if (Array.isArray(children)) return children.join('');
    return String(children ?? '');
  };

  const indexesRef = useRef({
    mermaid: 0,
    graphviz: 0,
    mathInline: 0,
    mathDisplay: 0,
    mathCode: 0,
  });

  const resetIndexes = () => {
    indexesRef.current = {
      mermaid: 0,
      graphviz: 0,
      mathInline: 0,
      mathDisplay: 0,
      mathCode: 0,
    };
  };

  resetIndexes();

  const components = {
    span({ className, children, node, ...props }: any) {
      if ((className || '').includes('math-inline')) {
        const value = node?.properties?.['data-math'] || node?.properties?.dataMath || String(children);
        return <MathKatex key={`math-inline-${indexesRef.current.mathInline++}`} value={value} displayMode={false} />;
      }
      return <span className={className} {...props}>{children}</span>;
    },
    div({ className, children, node, ...props }: any) {
      if ((className || '').includes('math-display')) {
        const value = node?.properties?.['data-math'] || node?.properties?.dataMath || String(children);
        return <MathKatex key={`math-display-${indexesRef.current.mathDisplay++}`} value={value} displayMode={true} />;
      }
      return <div className={className} {...props}>{children}</div>;
    },
    mark({ children }: any) {
      return <mark>{children}</mark>;
    },
    pre({ node, children, className, ...props }: any) {
      const codeNode =
        node?.children?.find?.((n: any) => n?.type === 'element' && n?.tagName === 'code') ??
        node?.children?.[0];
      const classList = codeNode?.properties?.className;
      const cn = Array.isArray(classList) ? classList.join(' ') : String(classList || className || '');
      const isDiagramOrMath =
        cn.includes('language-mermaid') ||
        cn.includes('language-dot') ||
        cn.includes('language-graphviz') ||
        cn.includes('language-math') ||
        cn.includes('math-display') ||
        cn.includes('math-inline');
      if (isDiagramOrMath) return <div {...props}>{children}</div>;
      return (
        <pre className={className} {...props}>
          {children}
        </pre>
      );
    },
    code({ inline, className, children }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const lang = match?.[1]?.toLowerCase();
      const raw = toText(children).replace(/\n$/, '');
      const isMermaid =
        lang === 'mermaid' ||
        (!inline &&
          !lang &&
          /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|mindmap|timeline)\b/.test(
            raw.trim()
          ));
      const isMath =
        lang === 'math' ||
        (className || '').includes('math-inline') ||
        (className || '').includes('math-display');
      const isMathInline = (className || '').includes('math-inline');
      const isMathDisplay = (className || '').includes('math-display');
      const displayMode = isMathDisplay || (lang === 'math' && !inline && !isMathInline);
      const isGraphviz = lang === 'dot' || lang === 'graphviz';

      if (isMermaid) {
        return <Mermaid key={`mermaid-${indexesRef.current.mermaid++}`} chart={raw} />;
      }

      if (isMath) {
        return <MathKatex key={`math-code-${indexesRef.current.mathCode++}`} value={raw} displayMode={displayMode} />;
      }

      if (isGraphviz) return <Graphviz key={`graphviz-${indexesRef.current.graphviz++}`} dot={raw} />;

      if (!inline && match) {
        return <CodeBlock language={match[1]} value={raw} />;
      }

      return <code className={className}>{children}</code>;
    },
  };

  return (
    <div
      className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-4xl prose-h1:tracking-tight prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-img:rounded-xl prose-img:shadow-lg"
      style={{
        fontSize: `${settings.fontSize || 16}px`,
        lineHeight: settings.lineHeight || 1.6,
        letterSpacing: `${settings.letterSpacing || 0}px`,
      }}
    >
      <ReactMarkdown
        remarkPlugins={[resolvePlugin(remarkGfm), resolvePlugin(remarkMath), remarkMark]}
        remarkRehypeOptions={
          {
            handlers: {
              mark(state: any, node: any) {
                return { type: 'element', tagName: 'mark', properties: {}, children: state.all(node) };
              },
              inlineMath(_state: any, node: any) {
                return {
                  type: 'element',
                  tagName: 'span',
                  properties: { className: ['math-inline'], 'data-math': node.value },
                  children: [{ type: 'text', value: node.value }],
                };
              },
              math(_state: any, node: any) {
                return {
                  type: 'element',
                  tagName: 'div',
                  properties: { className: ['math-display'], 'data-math': node.value },
                  children: [{ type: 'text', value: node.value }],
                };
              },
            },
          } as any
        }
        urlTransform={urlTransform}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
