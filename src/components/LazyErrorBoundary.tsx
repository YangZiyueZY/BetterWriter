import React from 'react';

type Props = {
  title?: string;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export class LazyErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60 backdrop-blur-xl shadow-xl p-6 text-center">
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{this.props.title || '模块加载失败'}</div>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">请检查网络后重试，或刷新页面。</div>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-semibold"
            >
              重试
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-blue-600 text-white font-bold"
            >
              刷新页面
            </button>
          </div>
        </div>
      </div>
    );
  }
}

