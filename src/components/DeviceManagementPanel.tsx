import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckSquare, Clock, Loader2, RefreshCw, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { userApi } from '../services/api';
import { ConfirmModal } from './ConfirmModal';
import { PasswordInput } from './PasswordInput';
import { useStore } from '../store/useStore';

type DeviceRow = {
  id: string;
  deviceName: string;
  deviceModel: string | null;
  deviceType: string;
  osInfo: string | null;
  lastLoginAt: number;
  lastLoginIp: string | null;
  lastLoginLocation: string | null;
  lastSeenAt: number;
  revokedAt: number | null;
  deletedAt: number | null;
  undoUntil: number | null;
  anomalous: boolean;
  anomalyReason: string | null;
  isCurrent: boolean;
};

type SecurityAlertRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: number;
  readAt: number | null;
};

const formatMinute = (ts: number | null): string => {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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

const PasswordConfirmModal: React.FC<{
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onConfirm: (password: string) => void;
  loading?: boolean;
}> = ({ isOpen, title, onClose, onConfirm, loading }) => {
  const [pw, setPw] = useState('');
  useEffect(() => {
    if (isOpen) setPw('');
  }, [isOpen]);
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.25 }}
            className="w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden relative z-10"
          >
            <div className="p-6 space-y-4">
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</div>
              <div className="text-sm text-slate-600 dark:text-slate-300">为保护账号安全，请输入当前账号密码进行验证。</div>
              <PasswordInput value={pw} onChange={setPw} placeholder="输入当前密码" required leftIcon={<ShieldAlert className="h-4 w-4 text-slate-400" />} />
            </div>
            <div className="flex border-t border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors border-r border-slate-200/60 dark:border-slate-800"
              >
                取消
              </button>
              <button
                onClick={() => onConfirm(pw)}
                disabled={loading || !pw}
                className="flex-1 px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50/60 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                <span>确认</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const DeviceManagementPanel: React.FC = () => {
  const { logout } = useStore();
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlertRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [q, setQ] = useState('');
  const [deviceType, setDeviceType] = useState('all');
  const [ip, setIp] = useState('');
  const [from, setFrom] = useState(() => toDateTimeLocal(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [to, setTo] = useState(() => toDateTimeLocal(Date.now()));
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });
  const [passwordModal, setPasswordModal] = useState<{ open: boolean; ids: string[] }>({ open: false, ids: [] });
  const [deleting, setDeleting] = useState(false);
  const [undoing, setUndoing] = useState<Record<string, boolean>>({});

  const refresh = async () => {
    setLoading(true);
    try {
      const fromTs = fromDateTimeLocal(from) ?? 0;
      const toTs = fromDateTimeLocal(to) ?? 0;
      const res = await userApi.listDevices({ q, deviceType, ip, from: fromTs, to: toTs, page, limit });
      setDevices(res.devices || []);
      setTotal(res.total || 0);
      setSelected((prev) => {
        const next: Record<string, boolean> = {};
        for (const d of res.devices || []) {
          if (prev[d.id]) next[d.id] = true;
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const res = await userApi.listSecurityAlerts({ onlyUnread: true });
      setAlerts(res.alerts || []);
    } finally {
      setLoadingAlerts(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [q, deviceType, ip, from, to, page]);

  useEffect(() => {
    void refreshAlerts();
  }, []);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);

  const toggleAll = () => {
    const all = devices.length > 0 && devices.every((d) => selected[d.id]);
    if (all) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const d of devices) next[d.id] = true;
    setSelected(next);
  };

  const onDelete = (ids: string[]) => {
    setConfirmDelete({ open: true, ids });
  };

  const runDelete = async (password: string, ids: string[]) => {
    setDeleting(true);
    try {
      if (ids.length === 1) {
        const res = await userApi.deleteDevice(ids[0], password);
        if (res?.self) {
          logout();
          window.location.reload();
          return;
        }
      } else {
        const res = await userApi.bulkDeleteDevices(ids, password);
        if (res?.selfDeleted) {
          logout();
          window.location.reload();
          return;
        }
      }
      setSelected({});
      await refresh();
    } finally {
      setDeleting(false);
    }
  };

  const undo = async (id: string) => {
    setUndoing((m) => ({ ...m, [id]: true }));
    try {
      await userApi.undoDeleteDevice(id);
      await refresh();
    } finally {
      setUndoing((m) => ({ ...m, [id]: false }));
    }
  };

  const markAlertRead = async (id: string) => {
    await userApi.readSecurityAlert(id);
    await refreshAlerts();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder="搜索设备/系统/地点"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <select
            value={deviceType}
            onChange={(e) => {
              setPage(1);
              setDeviceType(e.target.value);
            }}
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">全部类型</option>
            <option value="desktop">电脑</option>
            <option value="mobile">手机</option>
            <option value="tablet">平板</option>
            <option value="unknown">未知</option>
          </select>
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white/80 dark:bg-slate-950/60 hover:bg-white dark:hover:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            <span>刷新</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <input
          value={ip}
          onChange={(e) => {
            setPage(1);
            setIp(e.target.value);
          }}
          placeholder="按 IP 筛选（模糊匹配）"
          className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
        <input
          type="datetime-local"
          value={from}
          onChange={(e) => {
            setPage(1);
            setFrom(e.target.value);
          }}
          className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
        <input
          type="datetime-local"
          value={to}
          onChange={(e) => {
            setPage(1);
            setTo(e.target.value);
          }}
          className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>

      {alerts.length > 0 && (
        <div className="rounded-2xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-900/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-200 font-bold">
              <ShieldAlert size={18} />
              <span>安全提醒（{alerts.length}）</span>
            </div>
            <button
              onClick={() => void refreshAlerts()}
              disabled={loadingAlerts}
              className="px-3 py-2 rounded-xl bg-white/70 dark:bg-slate-950/40 border border-amber-200/60 dark:border-amber-900/40 text-amber-700 dark:text-amber-200 text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
            >
              {loadingAlerts ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              <span>刷新</span>
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {alerts.slice(0, 3).map((a) => (
              <div key={a.id} className="rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-white/60 dark:bg-slate-950/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{a.title}</div>
                  <button
                    onClick={() => void markAlertRead(a.id)}
                    className="px-2 py-1 rounded-lg text-xs font-bold border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300"
                  >
                    标记已读
                  </button>
                </div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">{a.message}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatMinute(a.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 flex-1">
          <button
            onClick={toggleAll}
            className="px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm flex items-center gap-2"
          >
            <CheckSquare size={16} />
            <span>全选/取消</span>
          </button>
          <div>已选 {selectedIds.length} / {devices.length}</div>
        </div>
        <button
          onClick={() => onDelete(selectedIds)}
          disabled={selectedIds.length === 0}
          className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-900/50 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
        >
          <Trash2 size={16} />
          <span>批量删除</span>
        </button>
      </div>

      <div className="hidden md:block rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/60 dark:bg-slate-950/40 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 text-left w-10"></th>
                <th className="px-4 py-3 text-left">设备</th>
                <th className="px-4 py-3 text-left">类型/系统</th>
                <th className="px-4 py-3 text-left">最后登录</th>
                <th className="px-4 py-3 text-left">IP/地点</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
              {devices.map((d) => {
                const now = Date.now();
                const canUndo = Boolean(d.undoUntil && d.undoUntil > now && d.deletedAt);
                const status = d.isCurrent ? 'current' : d.deletedAt || d.revokedAt ? 'removed' : 'active';
                return (
                  <tr key={d.id} className="text-slate-700 dark:text-slate-200">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={Boolean(selected[d.id])} onChange={() => setSelected((m) => ({ ...m, [d.id]: !m[d.id] }))} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{d.deviceName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{d.deviceModel || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{d.deviceType}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{d.osInfo || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{formatMinute(d.lastLoginAt)}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock size={12} />
                        <span>{formatMinute(d.lastSeenAt)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs">{d.lastLoginIp || '-'}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{d.lastLoginLocation || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={cn(
                            'px-2 py-1 rounded-lg text-xs font-bold border',
                            status === 'current'
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-900/50'
                              : status === 'active'
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-900/50'
                                : 'bg-slate-100 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-800'
                          )}
                        >
                          {status === 'current' ? '当前设备' : status === 'active' ? '已登录' : '历史设备'}
                        </span>
                        {d.anomalous && (
                          <span className="px-2 py-1 rounded-lg text-xs font-bold border bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200/60 dark:border-red-900/50 flex items-center gap-1">
                            <AlertTriangle size={12} />
                            <span>{d.anomalyReason || '异常登录'}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canUndo ? (
                          <button
                            onClick={() => void undo(d.id)}
                            disabled={Boolean(undoing[d.id])}
                            className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/50 text-xs font-semibold disabled:opacity-50 flex items-center gap-2"
                          >
                            {undoing[d.id] ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                            <span>撤销</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onDelete([d.id])}
                            className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100/70 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-900/50 text-xs font-semibold flex items-center gap-2"
                          >
                            <Trash2 size={14} />
                            <span>移除</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {devices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    暂无设备记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {devices.map((d) => {
          const now = Date.now();
          const canUndo = Boolean(d.undoUntil && d.undoUntil > now && d.deletedAt);
          const status = d.isCurrent ? 'current' : d.deletedAt || d.revokedAt ? 'removed' : 'active';
          return (
            <div key={d.id} className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate">{d.deviceName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{d.osInfo || '-'}</div>
                </div>
                <input type="checkbox" checked={Boolean(selected[d.id])} onChange={() => setSelected((m) => ({ ...m, [d.id]: !m[d.id] }))} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                <div>类型：{d.deviceType}</div>
                <div>最后登录：{formatMinute(d.lastLoginAt)}</div>
                <div className="font-mono">IP：{d.lastLoginIp || '-'}</div>
                <div className="truncate">地点：{d.lastLoginLocation || '-'}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={cn(
                    'px-2 py-1 rounded-lg text-xs font-bold border',
                    status === 'current'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-900/50'
                      : status === 'active'
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-900/50'
                        : 'bg-slate-100 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-800'
                  )}
                >
                  {status === 'current' ? '当前设备' : status === 'active' ? '已登录' : '历史设备'}
                </span>
                {d.anomalous && (
                  <span className="px-2 py-1 rounded-lg text-xs font-bold border bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200/60 dark:border-red-900/50 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    <span>{d.anomalyReason || '异常登录'}</span>
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onDelete([d.id])}
                  className="flex-1 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-900/50 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  <span>移除</span>
                </button>
                {canUndo && (
                  <button
                    onClick={() => void undo(d.id)}
                    disabled={Boolean(undoing[d.id])}
                    className="flex-1 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/50 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {undoing[d.id] ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
                    <span>撤销</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
        <div>
          第 {page} / {pageCount} 页（共 {total} 台）
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold disabled:opacity-50"
          >
            上一页
          </button>
          <button
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount}
            className="px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, ids: [] })}
        onConfirm={() => setPasswordModal({ open: true, ids: confirmDelete.ids })}
        title="确认移除登录设备？"
        message={confirmDelete.ids.length === 1 ? '移除后该设备将自动登出，并可在 5 分钟内撤销。' : `将移除选中的 ${confirmDelete.ids.length} 台设备，移除后将自动登出，并可在 5 分钟内撤销。`}
        confirmText="继续"
        cancelText="取消"
        type="warning"
      />

      <PasswordConfirmModal
        isOpen={passwordModal.open}
        title="请输入密码确认移除"
        onClose={() => setPasswordModal({ open: false, ids: [] })}
        onConfirm={(pw) => void runDelete(pw, passwordModal.ids).finally(() => setPasswordModal({ open: false, ids: [] }))}
        loading={deleting}
      />
    </div>
  );
};
