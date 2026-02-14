import React, { useEffect, useMemo, useState } from 'react';
import { Download, Filter, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { adminApi } from '../services/api';
import { clearClientLogs, getClientLogs, subscribeClientLogs, type ClientLogEntry } from '../lib/clientLogger';

const formatTs = (ts: number): string => {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
};

const toDateTimeLocal = (ts: number): string => {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

const fromDateTimeLocal = (s: string): number | null => {
  if (!s) return null;
  const ts = new Date(s).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const downloadText = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const DeveloperModeTab: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [backendLogs, setBackendLogs] = useState<any[]>([]);
  const [loadingBackendLogs, setLoadingBackendLogs] = useState(false);
  const [backendLevel, setBackendLevel] = useState<string>('all');
  const [backendModule, setBackendModule] = useState<string>('');
  const [backendQ, setBackendQ] = useState<string>('');
  const [backendFrom, setBackendFrom] = useState<string>(() => toDateTimeLocal(Date.now() - 6 * 60 * 60 * 1000));
  const [backendTo, setBackendTo] = useState<string>(() => toDateTimeLocal(Date.now()));
  const [clientLevel, setClientLevel] = useState<'all' | 'error' | 'warn' | 'info' | 'debug'>('all');
  const [clientQ, setClientQ] = useState('');
  const [clientFrom, setClientFrom] = useState<string>(() => toDateTimeLocal(Date.now() - 60 * 60 * 1000));
  const [clientTo, setClientTo] = useState<string>(() => toDateTimeLocal(Date.now()));
  const [clientLogs, setClientLogs] = useState<ClientLogEntry[]>(() => getClientLogs());

  useEffect(() => subscribeClientLogs(() => setClientLogs(getClientLogs())), []);

  const refreshMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const res = await adminApi.getMetrics();
      setMetrics(res);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const refreshBackendLogs = async () => {
    setLoadingBackendLogs(true);
    try {
      const from = fromDateTimeLocal(backendFrom) ?? Date.now() - 6 * 60 * 60 * 1000;
      const to = fromDateTimeLocal(backendTo) ?? Date.now();
      const res = await adminApi.getBackendLogs({
        level: backendLevel === 'all' ? undefined : backendLevel,
        module: backendModule || undefined,
        q: backendQ || undefined,
        from,
        to,
        limit: 500,
      });
      setBackendLogs(Array.isArray(res?.logs) ? res.logs : []);
    } finally {
      setLoadingBackendLogs(false);
    }
  };

  useEffect(() => {
    void refreshMetrics();
    void refreshBackendLogs();
    const t = setInterval(() => void refreshMetrics(), 5000);
    return () => clearInterval(t);
  }, []);

  const filteredClientLogs = useMemo(() => {
    const from = fromDateTimeLocal(clientFrom) ?? 0;
    const to = fromDateTimeLocal(clientTo) ?? Date.now();
    return clientLogs.filter((l) => {
      if (l.ts < from || l.ts > to) return false;
      if (clientLevel !== 'all' && l.level !== clientLevel) return false;
      if (clientQ && !l.msg.includes(clientQ)) return false;
      return true;
    });
  }, [clientLogs, clientLevel, clientQ, clientFrom, clientTo]);

  const exportClient = () => downloadText(`client-logs-${Date.now()}.json`, JSON.stringify(filteredClientLogs, null, 2));
  const exportBackend = () => downloadText(`backend-logs-${Date.now()}.json`, JSON.stringify(backendLogs, null, 2));

  return (
    <div className="space-y-8">
      <section className="bg-white/60 dark:bg-slate-800/40 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">服务器状态</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">轮询刷新：5s</div>
          </div>
          <button
            onClick={refreshMetrics}
            disabled={loadingMetrics}
            className="px-4 py-2.5 rounded-xl bg-white/80 dark:bg-slate-950/60 hover:bg-white dark:hover:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loadingMetrics ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            <span>刷新</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-950/40">
            <div className="text-slate-500 dark:text-slate-400">进程</div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">pid {metrics?.pid ?? '-'}</div>
            <div className="text-slate-600 dark:text-slate-300">uptime {metrics?.uptime ? `${Math.floor(metrics.uptime)}s` : '-'}</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-950/40">
            <div className="text-slate-500 dark:text-slate-400">内存（进程）</div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">{metrics?.mem?.rss ? `${Math.round(metrics.mem.rss / 1024 / 1024)} MB` : '-'}</div>
            <div className="text-slate-600 dark:text-slate-300">{metrics?.mem?.heapUsed ? `heap ${Math.round(metrics.mem.heapUsed / 1024 / 1024)} MB` : ''}</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-950/40">
            <div className="text-slate-500 dark:text-slate-400">系统</div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">{metrics?.hostname ?? '-'}</div>
            <div className="text-slate-600 dark:text-slate-300">{Array.isArray(metrics?.loadavg) ? `load ${metrics.loadavg.map((n: any) => Number(n).toFixed(2)).join(' ')}` : ''}</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-950/40">
            <div className="text-slate-500 dark:text-slate-400">CPU（进程）</div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {typeof metrics?.cpu?.percent === 'number' ? `${metrics.cpu.percent.toFixed(1)}%` : '-'}
            </div>
            <div className="text-slate-600 dark:text-slate-300">{metrics?.cpuCount ? `${metrics.cpuCount} cores` : ''}</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-950/40">
            <div className="text-slate-500 dark:text-slate-400">磁盘</div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {typeof metrics?.disk?.usedPercent === 'number' ? `${metrics.disk.usedPercent.toFixed(1)}%` : '-'}
            </div>
            <div className="text-slate-600 dark:text-slate-300">
              {metrics?.disk?.usedBytes ? `${Math.round(metrics.disk.usedBytes / 1024 / 1024 / 1024)} GB used` : ''}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-950/40">
            <div className="text-slate-500 dark:text-slate-400">网络 IO</div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {metrics?.network?.io?.rxBytes ? `${Math.round(metrics.network.io.rxBytes / 1024 / 1024)} MB RX` : '-'}
            </div>
            <div className="text-slate-600 dark:text-slate-300">
              {metrics?.network?.io?.txBytes ? `${Math.round(metrics.network.io.txBytes / 1024 / 1024)} MB TX` : ''}
            </div>
          </div>
        </div>

        {Array.isArray(metrics?.processes?.list) && (
          <div className="mt-5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/50 dark:bg-slate-950/40 overflow-hidden">
            <div className="px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-100 border-b border-slate-200/60 dark:border-slate-700/60">
              进程状态（Top）
            </div>
            <div className="max-h-[220px] overflow-auto">
              <table className="min-w-full text-xs font-mono">
                <thead className="bg-slate-50/50 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2 text-left">pid</th>
                    <th className="px-4 py-2 text-left">name</th>
                    <th className="px-4 py-2 text-left">cpu</th>
                    <th className="px-4 py-2 text-left">mem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {metrics.processes.list.slice(0, 30).map((p: any, i: number) => (
                    <tr key={`${p.pid || p.name}-${i}`} className="text-slate-700 dark:text-slate-200">
                      <td className="px-4 py-2">{p.pid ?? '-'}</td>
                      <td className="px-4 py-2">{p.name ?? '-'}</td>
                      <td className="px-4 py-2">{p.cpu ?? '-'}</td>
                      <td className="px-4 py-2">{p.memPercent ?? p.mem ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white/60 dark:bg-slate-800/40 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">前端日志</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">捕获 console 日志（最多 2000 条）</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => clearClientLogs()}
              className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-900/50 text-sm font-semibold flex items-center gap-2"
            >
              <Trash2 size={14} />
              <span>清空</span>
            </button>
            <button
              onClick={exportClient}
              className="px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-sm font-semibold flex items-center gap-2"
            >
              <Download size={14} />
              <span>导出</span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <select
              value={clientLevel}
              onChange={(e) => setClientLevel(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="all">全部</option>
              <option value="error">error</option>
              <option value="warn">warn</option>
              <option value="info">info</option>
              <option value="debug">debug</option>
            </select>
          </div>
          <input
            type="datetime-local"
            value={clientFrom}
            onChange={(e) => setClientFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <input
            type="datetime-local"
            value={clientTo}
            onChange={(e) => setClientTo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <input
            value={clientQ}
            onChange={(e) => setClientQ(e.target.value)}
            placeholder="关键字搜索"
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="mt-4 max-h-[320px] overflow-auto rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
            {filteredClientLogs.map((l, idx) => (
              <div key={`${l.ts}-${idx}`} className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                <span className={cn(l.level === 'error' ? 'text-red-600 dark:text-red-400' : l.level === 'warn' ? 'text-amber-600 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400')}>
                  [{l.level}]
                </span>{' '}
                <span className="text-slate-500 dark:text-slate-400">{formatTs(l.ts)}</span>{' '}
                <span className="break-words">{l.msg}</span>
              </div>
            ))}
            {filteredClientLogs.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">暂无日志</div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white/60 dark:bg-slate-800/40 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">后端日志</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">JSONL 日志（默认拉取最近 6 小时）</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refreshBackendLogs}
              disabled={loadingBackendLogs}
              className="px-4 py-2.5 rounded-xl bg-white/80 dark:bg-slate-950/60 hover:bg-white dark:hover:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loadingBackendLogs ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              <span>刷新</span>
            </button>
            <button
              onClick={exportBackend}
              className="px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-950/60 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-sm font-semibold flex items-center gap-2"
            >
              <Download size={14} />
              <span>导出</span>
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={backendLevel}
            onChange={(e) => setBackendLevel(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">全部级别</option>
            <option value="error">error</option>
            <option value="warn">warn</option>
            <option value="info">info</option>
            <option value="debug">debug</option>
          </select>
          <input
            value={backendModule}
            onChange={(e) => setBackendModule(e.target.value)}
            placeholder="模块（精确匹配）"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              value={backendFrom}
              onChange={(e) => setBackendFrom(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <input
              type="datetime-local"
              value={backendTo}
              onChange={(e) => setBackendTo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <input
            value={backendQ}
            onChange={(e) => setBackendQ(e.target.value)}
            placeholder="关键字搜索"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="mt-4 max-h-[360px] overflow-auto rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
            {backendLogs.map((l: any, idx: number) => {
              const msg = String(l?.msg || '');
              const isStack = msg.includes('\n') || msg.includes(' at ');
              const lines = msg.split('\n');
              return (
                <div key={`${l.ts}-${idx}`} className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                  <span className={cn(l.level === 'error' ? 'text-red-600 dark:text-red-400' : l.level === 'warn' ? 'text-amber-600 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400')}>
                    [{l.level}]
                  </span>{' '}
                  <span className="text-slate-500 dark:text-slate-400">{formatTs(Number(l.ts) || 0)}</span>{' '}
                  <span className="text-slate-500 dark:text-slate-400">{l.module ? `[${l.module}]` : ''}</span>{' '}
                  <span className={cn('break-words', isStack && 'whitespace-pre-wrap')}>
                    {lines.map((line, i) => {
                      const isError = line.startsWith('Error') || line.includes('Error:');
                      const isAt = line.includes(' at ');
                      return (
                        <span
                          key={i}
                          className={cn(isError && 'text-red-600 dark:text-red-400', isAt && 'text-amber-700 dark:text-amber-300')}
                        >
                          {line}
                          {i < lines.length - 1 ? '\n' : ''}
                        </span>
                      );
                    })}
                  </span>
                </div>
              );
            })}
            {backendLogs.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">暂无日志</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
