import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Loader2, RefreshCw, Search, ShieldAlert, Trash2, UserRoundCog } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';
import { getEyeCareModalBackgroundColor } from '../lib/theme';
import { ConfirmModal } from './ConfirmModal';
import { adminApi } from '../services/api';

type AdminUserRow = {
  id: number;
  username: string;
  status: 'active' | 'disabled';
  createdAt: number | string | null;
  lastLoginAt: number | null;
};

const formatTs = (ts: any): string => {
  const n = typeof ts === 'number' ? ts : Number(ts);
  if (!Number.isFinite(n) || n <= 0) return '-';
  const d = new Date(n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
};

const PasswordResetModal: React.FC<{
  isOpen: boolean;
  username: string;
  onClose: () => void;
  onConfirm: (newPassword: string) => void;
  loading?: boolean;
  resultPassword?: string | null;
}> = ({ isOpen, username, onClose, onConfirm, loading, resultPassword }) => {
  const { settings } = useStore();
  const modalBgColor = getEyeCareModalBackgroundColor(settings);
  const [value, setValue] = useState('');
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'confirm' | 'input' | 'result'>('confirm');

  useEffect(() => {
    if (isOpen) {
      setValue('');
      setCopied(false);
      setStep(resultPassword ? 'result' : 'confirm');
    }
  }, [isOpen, resultPassword]);

  const copy = async () => {
    if (!resultPassword) return;
    try {
      await navigator.clipboard.writeText(resultPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
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
            className={cn(
              'rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ring-1 ring-slate-900/5 dark:ring-slate-100/10 backdrop-blur-xl z-10 relative',
              !modalBgColor && 'bg-white/90 dark:bg-slate-900/90'
            )}
            style={{ backgroundColor: modalBgColor }}
          >
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-100/80 dark:bg-amber-900/30 flex items-center justify-center">
                  <ShieldAlert className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                </div>
                <div className="flex-1">
                  <div className="text-lg font-bold text-slate-900 dark:text-slate-100">重置密码</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">账号：{username}</div>
                </div>
              </div>

              {resultPassword ? (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">新密码（仅显示一次）</div>
                  <div className="relative">
                    <div className="w-full px-4 py-3 pr-12 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-mono break-all">
                      {resultPassword}
                    </div>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={copy}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">请立即复制并交付给用户，关闭后将无法再次查看。</div>
                </div>
              ) : (
                step === 'confirm' ? (
                  <div className="space-y-2">
                    <div className="text-sm text-slate-700 dark:text-slate-200 font-semibold">确认要重置该账号密码？</div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">将强制该账号所有设备下线。</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm text-slate-600 dark:text-slate-300">可指定新密码；留空则自动生成。</div>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="留空自动生成（至少 6 位）"
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/70 dark:bg-slate-950/70 dark:text-slate-100 shadow-sm"
                      autoFocus
                    />
                  </div>
                )
              )}
            </div>

            <div className="flex border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-sm">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors border-r border-slate-200/50 dark:border-slate-700/50"
              >
                关闭
              </button>
              {!resultPassword && step === 'confirm' && (
                <button
                  onClick={() => setStep('input')}
                  className="flex-1 px-4 py-3 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-2"
                >
                  <span>继续</span>
                </button>
              )}
              {!resultPassword && step === 'input' && (
                <button
                  onClick={() => onConfirm(value)}
                  disabled={loading || (value.trim().length > 0 && value.trim().length < 6)}
                  className="flex-1 px-4 py-3 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  <span>确认重置</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const AdminUsersTab: React.FC = () => {
  const { user } = useStore();
  const [loading, setLoading] = useState(false);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'disabled'>('all');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; target?: AdminUserRow }>(() => ({ open: false }));
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [resetFlow, setResetFlow] = useState<{ open: boolean; target?: AdminUserRow; resultPassword?: string | null }>(() => ({ open: false, resultPassword: null }));
  const [resetLoading, setResetLoading] = useState(false);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[Number(k)]).map((k) => Number(k)), [selected]);
  const allChecked = useMemo(() => users.length > 0 && users.every((u) => selected[u.id]), [users, selected]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers({ q, status: status === 'all' ? undefined : status, page: 1, limit: 200 });
      setUsers(res.users || []);
      setSelected((prev) => {
        const next: Record<number, boolean> = {};
        for (const u of res.users || []) {
          if (prev[u.id]) next[u.id] = true;
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  const refreshAudits = useCallback(async () => {
    setLoadingAudits(true);
    try {
      const res = await adminApi.listAudits({ page: 1, limit: 50 });
      setAudits(res.audits || []);
    } finally {
      setLoadingAudits(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshAudits();
  }, [refresh, refreshAudits]);

  const toggleAll = () => {
    if (allChecked) {
      const next: Record<number, boolean> = {};
      setSelected(next);
      return;
    }
    const next: Record<number, boolean> = {};
    for (const u of users) next[u.id] = true;
    setSelected(next);
  };

  const toggleOne = (id: number) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const bulkSetStatus = async (nextStatus: 'active' | 'disabled') => {
    if (selectedIds.length === 0) return;
    await adminApi.bulkStatus(selectedIds, nextStatus);
    await refresh();
  };

  const doDelete = async (target: AdminUserRow) => {
    await adminApi.deleteUser(target.id);
    await refresh();
  };

  const doBulkDelete = async () => {
    await adminApi.bulkDelete(selectedIds);
    setSelected({});
    await refresh();
  };

  const beginReset = (target: AdminUserRow) => setResetFlow({ open: true, target, resultPassword: null });

  const confirmReset = async (newPassword: string) => {
    if (!resetFlow.target) return;
    setResetLoading(true);
    try {
      const res = await adminApi.resetPassword(resetFlow.target.id, newPassword.trim() || undefined);
      setResetFlow((s) => ({ ...s, resultPassword: res.newPassword || null }));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索用户名"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">全部状态</option>
            <option value="active">启用</option>
            <option value="disabled">禁用</option>
          </select>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl bg-white/80 dark:bg-slate-950/60 hover:bg-white dark:hover:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          <span>刷新</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="text-sm text-slate-600 dark:text-slate-300 flex-1">
          当前登录：{user?.username || '-'}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => bulkSetStatus('active')}
            disabled={selectedIds.length === 0}
            className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/50 text-sm font-semibold disabled:opacity-50"
          >
            批量启用
          </button>
          <button
            onClick={() => bulkSetStatus('disabled')}
            disabled={selectedIds.length === 0}
            className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/50 text-sm font-semibold disabled:opacity-50"
          >
            批量禁用
          </button>
          <button
            onClick={() => setConfirmBulkDelete(true)}
            disabled={selectedIds.length === 0}
            className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-900/50 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            <Trash2 size={14} />
            <span>批量删除</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/60 dark:bg-slate-950/40 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                </th>
                <th className="px-4 py-3 text-left">用户名</th>
                <th className="px-4 py-3 text-left">注册时间</th>
                <th className="px-4 py-3 text-left">最后登录</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-200/50 dark:border-slate-800">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={Boolean(selected[u.id])} onChange={() => toggleOne(u.id)} />
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{u.username}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatTs(u.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatTs(u.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2 py-1 rounded-lg text-xs font-bold border',
                        u.status === 'active'
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-900/50'
                          : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-900/50'
                      )}
                    >
                      {u.status === 'active' ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => beginReset(u)}
                        className="px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-950/60 hover:bg-white dark:hover:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-2"
                      >
                        <UserRoundCog size={14} />
                        <span>重置密码</span>
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ open: true, target: u })}
                        className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100/70 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-900/50 text-xs font-semibold flex items-center gap-2"
                      >
                        <Trash2 size={14} />
                        <span>删除</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    暂无用户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800">
          <div className="font-bold text-slate-900 dark:text-slate-100">操作审计日志</div>
          <button
            onClick={() => void refreshAudits()}
            disabled={loadingAudits}
            className="px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-950/60 hover:bg-white dark:hover:bg-slate-950 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            {loadingAudits ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            <span>刷新</span>
          </button>
        </div>
        <div className="max-h-[240px] overflow-auto divide-y divide-slate-200/60 dark:divide-slate-800">
          {audits.map((a, idx) => (
            <div key={`${a.id}-${idx}`} className="px-5 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-slate-200">
                <span className="font-semibold">{a.action}</span>
                <span className="text-slate-500 dark:text-slate-400">{formatTs(a.createdAt)}</span>
                {a.targetUserId ? <span className="text-slate-500 dark:text-slate-400">target#{a.targetUserId}</span> : null}
              </div>
              {a.meta ? <div className="mt-1 text-xs font-mono text-slate-500 dark:text-slate-400 break-all">{typeof a.meta === 'string' ? a.meta : JSON.stringify(a.meta)}</div> : null}
            </div>
          ))}
          {audits.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">暂无审计记录</div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false })}
        onConfirm={() => {
          if (!confirmDelete.target) return;
          void doDelete(confirmDelete.target).finally(() => setConfirmDelete({ open: false }));
        }}
        title="确认删除账号？"
        message={confirmDelete.target ? `将删除账号 ${confirmDelete.target.username}，并清理其数据（文档/存储配置/本地上传）。` : ''}
        confirmText="删除"
        cancelText="取消"
        type="danger"
      />

      <ConfirmModal
        isOpen={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={() => void doBulkDelete().finally(() => setConfirmBulkDelete(false))}
        title="确认批量删除？"
        message={`将删除选中的 ${selectedIds.length} 个账号，并清理其数据。`}
        confirmText="删除"
        cancelText="取消"
        type="danger"
      />

      <PasswordResetModal
        isOpen={resetFlow.open}
        username={resetFlow.target?.username || ''}
        onClose={() => setResetFlow({ open: false, resultPassword: null })}
        onConfirm={(pw) => void confirmReset(pw)}
        loading={resetLoading}
        resultPassword={resetFlow.resultPassword || null}
      />
    </div>
  );
};
