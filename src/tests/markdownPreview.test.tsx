import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownPreview } from '../components/MarkdownPreview';

vi.mock('katex/dist/katex.min.css', () => ({}));
vi.mock('katex/dist/katex.mjs', () => ({
  default: {
    renderToString: (value: string, opts: any) =>
      opts?.displayMode ? `<span class="katex-display">${value}</span>` : `<span class="katex">${value}</span>`,
  },
}));

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (_id: string, chart: string) => ({ svg: `<svg data-mermaid="1"><text>${chart}</text></svg>` })),
  },
}));

vi.mock('@viz-js/viz', () => ({
  default: async () => ({
    renderString: async (dot: string) => `<svg data-graphviz="1"><text>${dot}</text></svg>`,
  }),
}));

const settings: any = { fontSize: 16, lineHeight: 1.6, letterSpacing: 0 };

describe('MarkdownPreview syntax compatibility', () => {
  it('renders ==highlight== as <mark>', () => {
    const { container } = render(<MarkdownPreview content="这是==高亮文本==测试" settings={settings} />);
    const mark = container.querySelector('mark');
    expect(mark).toBeTruthy();
    expect(mark?.textContent).toContain('高亮文本');
  });

  it('renders inline $...$ with KaTeX markup', async () => {
    const { container } = render(<MarkdownPreview content={'行内 $a+b$ 结束'} settings={settings} />);
    await waitFor(() => expect(container.querySelector('.katex')).toBeTruthy());
    expect(container.textContent).toContain('行内');
  });

  it('renders block $$...$$ with KaTeX display markup', async () => {
    const md = ['$$', 'a+b', '$$'].join('\n');
    const { container } = render(<MarkdownPreview content={md} settings={settings} />);
    await waitFor(() => expect(container.querySelector('.katex-display')).toBeTruthy());
    const el = container.querySelector('.katex-display')!;
    expect(el.closest('pre')).toBeNull();
  });

  it('renders mermaid code fence as SVG diagram', async () => {
    const md = ['```mermaid', 'graph TD;', 'A-->B', '```'].join('\n');
    const { container } = render(<MarkdownPreview content={md} settings={settings} />);
    await waitFor(() => expect(container.querySelector('svg[data-mermaid="1"]')).toBeTruthy());
    const svg = container.querySelector('svg[data-mermaid="1"]')!;
    expect(svg.closest('pre')).toBeNull();
  });

  it('renders graphviz code fence as image', async () => {
    const md = ['```dot', 'digraph { a -> b }', '```'].join('\n');
    const { container } = render(<MarkdownPreview content={md} settings={settings} />);
    await waitFor(() => expect(container.querySelector('img[alt="graphviz"]')).toBeTruthy());
    const img = container.querySelector('img[alt="graphviz"]') as HTMLImageElement;
    expect(img.src.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('supports GFM tables and task lists', () => {
    const md = ['- [x] done', '', '| a | b |', '| - | - |', '| 1 | 2 |'].join('\n');
    const { container } = render(<MarkdownPreview content={md} settings={settings} />);
    expect(container.querySelector('table')).toBeTruthy();
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    expect(checkbox.checked).toBe(true);
  });

  it('keeps CommonMark basics consistent', () => {
    render(<MarkdownPreview content={'**bold** and *italic*'} settings={settings} />);
    expect(screen.getByText('bold').tagName.toLowerCase()).toBe('strong');
    expect(screen.getByText('italic').tagName.toLowerCase()).toBe('em');
  });
});
