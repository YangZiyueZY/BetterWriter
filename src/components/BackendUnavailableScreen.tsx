import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, ServerCrash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import api from '../services/api';
import { type BackendStatus } from '../lib/backendStatus';

const formatSince = (ts: number | null): string => {
  if (!ts) return '-';
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
};

export const BackendUnavailableScreen: React.FC<{ status: BackendStatus }> = ({ status }) => {
  const [checking, setChecking] = useState(false);
  const [autoRetry, setAutoRetry] = useState(true);
  const message = useMemo(() => status.message || '无法连接到后端服务', [status.message]);

  const check = async () => {
    setChecking(true);
    try {
      await api.get('/health', { timeout: 2500, __bwSkipLoading: true } as any);
    } catch {
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!autoRetry) return;
    const t = setInterval(() => {
      if (checking) return;
      void check();
    }, 5000);
    return () => clearInterval(t);
  }, [autoRetry, checking]);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <AnimatePresence mode="wait">
        {status.down && (
          <motion.div
            key="backend-down"
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.25 }}
            className="w-full max-w-md rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden"
          >
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-red-100/80 dark:bg-red-900/30 flex items-center justify-center">
                  <ServerCrash className="h-6 w-6 text-red-600 dark:text-red-300" />
                </div>
                <div className="flex-1">
                  <div className="text-lg font-bold">无法连接到后端</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">{message}</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">开始时间</span>
                  <span className="font-mono">{formatSince(status.since)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">自动重试</span>
                  <button
                    type="button"
                    onClick={() => setAutoRetry((v) => !v)}
                    className={cn(
                      'px-2 py-1 rounded-lg text-xs font-bold border',
                      autoRetry
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-900/50'
                        : 'bg-slate-100 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-800'
                    )}
                  >
                    {autoRetry ? '开启' : '关闭'}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                <AlertTriangle className="h-4 w-4 mt-[2px]" />
                <div>请确认后端服务已启动、端口/域名配置正确（VITE_API_BASE_URL），以及网络连接正常。</div>
              </div>
            </div>

            <div className="flex border-t border-slate-200/60 dark:border-slate-800 bg-white/60 dark:bg-slate-950/30">
              <button
                type="button"
                onClick={() => void check()}
                disabled={checking}
                className="flex-1 px-4 py-3 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {checking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                <span>重试连接</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
