import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';

type PasswordInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  leftIcon?: React.ReactNode;
  autoComplete?: string;
  name?: string;
  id?: string;
};

export const PasswordInput: React.FC<PasswordInputProps> = ({
  value,
  onChange,
  placeholder,
  required,
  className,
  inputClassName,
  leftIcon,
  autoComplete,
  name,
  id,
}) => {
  const [visible, setVisible] = useState(false);
  const [showToggle, setShowToggle] = useState(Boolean(value));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setShowToggle(Boolean(value) || visible);
    }, 80);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, visible]);

  const icon = useMemo(() => (visible ? <Eye size={16} /> : <EyeOff size={16} />), [visible]);

  return (
    <div className={cn('relative group', className)}>
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className={cn(
          'w-full px-4 py-3 pl-10 pr-10 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/70 dark:bg-slate-950/70 dark:text-slate-100 shadow-sm',
          inputClassName
        )}
        data-testid="password-input"
      />
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{leftIcon}</div>
      {showToggle && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none transition-colors"
          aria-label={visible ? '隐藏密码' : '显示密码'}
          data-testid="password-toggle"
        >
          {icon}
        </button>
      )}
    </div>
  );
};
