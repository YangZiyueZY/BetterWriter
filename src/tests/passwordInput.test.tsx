import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { PasswordInput } from '../components/PasswordInput';

describe('PasswordInput', () => {
  it('默认不可见，输入后按钮出现且文案为显示密码', async () => {
    vi.useFakeTimers();
    const Wrapper = () => {
      const [v, setV] = React.useState('');
      return <PasswordInput value={v} onChange={setV} placeholder="pwd" />;
    };
    render(<Wrapper />);
    const input = screen.getByTestId('password-input') as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(screen.queryByTestId('password-toggle')).toBeNull();
    fireEvent.change(input, { target: { value: 'x' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });
    expect(screen.getByTestId('password-toggle')).toHaveAttribute('aria-label', '显示密码');
    vi.useRealTimers();
  });

  it('快速输入/粘贴长密码不产生重复图标或按钮', async () => {
    vi.useFakeTimers();
    const Wrapper = () => {
      const [v, setV] = React.useState('');
      return <PasswordInput value={v} onChange={setV} placeholder="pwd" />;
    };
    render(<Wrapper />);
    const input = screen.getByTestId('password-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a'.repeat(120) } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });
    expect(screen.getAllByTestId('password-toggle')).toHaveLength(1);
    expect(input.value.length).toBe(120);

    fireEvent.change(input, { target: { value: 'b'.repeat(180) } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });
    expect(screen.getAllByTestId('password-toggle')).toHaveLength(1);
    expect(input.value.length).toBe(180);
    vi.useRealTimers();
  });

  it('切换可见后继续输入保持可见', async () => {
    vi.useFakeTimers();
    const Wrapper = () => {
      const [v, setV] = React.useState('init');
      return <PasswordInput value={v} onChange={setV} placeholder="pwd" />;
    };
    render(<Wrapper />);
    const input = screen.getByTestId('password-input') as HTMLInputElement;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });
    const toggle = screen.getByTestId('password-toggle');
    fireEvent.click(toggle);
    expect(input.type).toBe('text');
    expect(toggle).toHaveAttribute('aria-label', '隐藏密码');
    fireEvent.change(input, { target: { value: 'init123' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });
    expect(input.value).toBe('init123');
    expect(input.type).toBe('text');
    vi.useRealTimers();
  });

  it('浏览器自动填充场景仍可正常切换', async () => {
    vi.useFakeTimers();
    const Wrapper = () => {
      const [v, setV] = React.useState('');
      return <PasswordInput value={v} onChange={setV} placeholder="pwd" autoComplete="current-password" />;
    };
    render(<Wrapper />);
    const input = screen.getByTestId('password-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'autofilled' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });
    expect(input.value).toBe('autofilled');
    const toggle = screen.getByTestId('password-toggle');
    fireEvent.click(toggle);
    expect(input.type).toBe('text');
    vi.useRealTimers();
  });
});
