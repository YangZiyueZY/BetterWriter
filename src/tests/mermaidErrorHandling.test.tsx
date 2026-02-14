import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Mermaid } from '../components/Mermaid';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => ({ svg: '<svg><text>Syntax error in text mermaid version 11.12.2</text></svg>' })),
  },
}));

describe('Mermaid 错误处理', () => {
  it('语法错误时不显示原始错误文本', async () => {
    vi.useFakeTimers();
    const { container } = render(<Mermaid chart="graph TD; A-->B" />);
    vi.advanceTimersByTime(200);
    await Promise.resolve();
    expect(container.textContent || '').not.toContain('Syntax error in text');
    expect(container.textContent || '').not.toContain('mermaid version');
    vi.useRealTimers();
  });
});
