import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { getLoadingState, subscribeLoading, type LoadingState } from '../lib/loadingManager';
import { cn } from '../lib/utils';

const formatElapsed = (ms: number) => {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m${String(s).padStart(2, '0')}s`;
};

export const GlobalLoadingOverlay: React.FC = () => {
  const [s, setS] = useState<LoadingState>(() => getLoadingState());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeLoading((st) => setS(st)), []);

  useEffect(() => {
    if (!s.visible) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [s.visible]);

  const elapsedMs = useMemo(() => (s.since ? Math.max(0, now - s.since) : 0), [now, s.since]);
  const showSlowHint = useMemo(() => s.visible && elapsedMs >= s.config.slowHintMs, [s.visible, elapsedMs, s.config.slowHintMs]);

  return (
    <AnimatePresence>
      {s.visible && (
        <motion.div
          key="global-loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn('fixed inset-0 z-[9999] flex items-center justify-center', s.config.blockInteraction ? 'pointer-events-auto' : 'pointer-events-none')}
          style={{ backgroundColor: s.config.theme.backgroundColor }}
          aria-live="polite"
          aria-busy="true"
          role="status"
        >
          <div className="w-full max-w-sm px-6">
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white/90 dark:bg-slate-950/70 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="p-6 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                  <Loader2 className="w-7 h-7 animate-spin" style={{ color: s.config.theme.accentColor }} aria-hidden="true" />
                </div>

                <div className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">{s.title || s.config.title}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">已等待 {formatElapsed(elapsedMs)}</div>

                <div className="mt-5 h-2 rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden border border-slate-200/60 dark:border-slate-800">
                  <div className="bw-loading-bar h-full w-2/3 rounded-full" style={{ backgroundColor: s.config.theme.accentColor, opacity: 0.85, willChange: 'transform' }} />
                </div>

                {showSlowHint && (
                  <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">{s.config.slowHintText}</div>
                )}
              </div>
            </div>
          </div>

          <span className="sr-only">{s.title || s.config.title}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

