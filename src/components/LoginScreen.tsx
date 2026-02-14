import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { User, Lock, Loader2, ArrowRight, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { PasswordInput } from './PasswordInput';
import { v4 as uuidv4 } from 'uuid';

const getDeviceKey = (): string => {
  try {
    const k = localStorage.getItem('bw-device-key');
    if (k) return k;
    const next = uuidv4();
    localStorage.setItem('bw-device-key', next);
    return next;
  } catch {
    return uuidv4();
  }
};

const getDeviceInfo = () => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform = typeof navigator !== 'undefined' ? (navigator as any).userAgentData?.platform || navigator.platform || '' : '';
  const lower = ua.toLowerCase();
  const isMobile = /mobile|android|iphone|ipod/.test(lower);
  const isTablet = /ipad|tablet/.test(lower);
  const deviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';
  let osInfo = platform || '';
  if (!osInfo) {
    if (lower.includes('windows')) osInfo = 'Windows';
    else if (lower.includes('mac os')) osInfo = 'macOS';
    else if (lower.includes('android')) osInfo = 'Android';
    else if (lower.includes('iphone') || lower.includes('ipad') || lower.includes('ios')) osInfo = 'iOS';
    else if (lower.includes('linux')) osInfo = 'Linux';
  }
  const deviceName = `${deviceType === 'desktop' ? '电脑' : deviceType === 'tablet' ? '平板' : '手机'} (${osInfo || 'Unknown'})`;
  return {
    deviceKey: getDeviceKey(),
    deviceType,
    deviceName,
    deviceModel: null,
    osInfo: osInfo || null,
  };
};

export const LoginScreen: React.FC = () => {
  const { login, fetchFiles } = useStore();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);

    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const payload: any = { username: username.trim(), password };
      if (authMode === 'login') {
        Object.assign(payload, getDeviceInfo());
      }
      const res = await api.post(endpoint, payload);
      
      if (authMode === 'login') {
          // Success: Store updates will trigger App re-render to main screen
          login(res.data.user, res.data.token);
          fetchFiles(); // Sync files after login
      } else {
          setAuthMode('login');
          setAuthError('');
          setShowSuccessModal(true);
          setUsername('');
          setPassword('');
      }
    } catch (err: any) {
      const code = err.response?.data?.code;
      if (code === 'IP_BANNED') {
        const retryAfterSec = Number(err.response?.data?.retryAfterSec);
        const sec = Number.isFinite(retryAfterSec) ? retryAfterSec : 0;
        setAuthError(sec > 0 ? `当前IP登录失败次数过多，请在 ${sec} 秒后重试` : '当前IP登录失败次数过多，请稍后重试');
      } else if (code === 'ACCOUNT_DISABLED') {
        setAuthError('账号已被禁用，请联系管理员');
      } else if (code === 'DEVICE_LIMIT') {
        const limit = Number(err.response?.data?.limit);
        setAuthError(Number.isFinite(limit) ? `该账号同时在线设备数量已达上限（${limit} 台），请先在设备管理中移除旧设备` : '该账号同时在线设备数量已达上限，请先移除旧设备');
      } else if (code === 'DEVICE_INFO_MISSING') {
        setAuthError('设备信息获取失败，请刷新页面后重试');
      } else {
        setAuthError(err.response?.data?.error || '认证失败，请检查用户名或密码');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-500 relative overflow-hidden">
        {/* Ambient Background */}
        <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[100px] animate-pulse-slow" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
        </div>

        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full max-w-md z-10"
        >
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden">
                <div className="p-8 md:p-10">
                    <div className="text-center mb-8">
                        <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2, type: "spring" }}
                            className="inline-flex h-20 w-20 items-center justify-center mb-6"
                        >
                            <img src="/favicon.svg" alt="Logo" className="w-full h-full object-contain drop-shadow-xl" />
                        </motion.div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                            {authMode === 'login' ? '欢迎回来' : '创建账号'}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                            {authMode === 'login' ? '登录以继续您的写作之旅' : '开始体验更好的写作环境'}
                        </p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-5">
                        <AnimatePresence mode="wait">
                            {authError && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-3 flex items-center gap-3 text-sm text-red-600 dark:text-red-300"
                                >
                                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                                    {authError}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">用户名</label>
                                <div className="relative group">
                                    <input 
                                        type="text" 
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full px-4 py-3.5 pl-11 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm group-hover:bg-white dark:group-hover:bg-slate-950"
                                        placeholder="请输入用户名"
                                        required
                                    />
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">密码</label>
                                <PasswordInput
                                  value={password}
                                  onChange={setPassword}
                                  placeholder="请输入密码"
                                  required
                                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                                  leftIcon={<Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />}
                                  className="relative group"
                                  inputClassName="px-4 py-3.5 pl-11 pr-11 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-blue-500/50 group-hover:bg-white dark:group-hover:bg-slate-950"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full py-3.5 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span>处理中...</span>
                                </>
                            ) : (
                                <>
                                    <span>{authMode === 'login' ? '登 录' : '注 册'}</span>
                                    <ArrowRight className="h-4 w-4 opacity-50" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {authMode === 'login' ? '还没有账号？' : '已有账号？'}
                            <button 
                                onClick={() => {
                                    setAuthMode(authMode === 'login' ? 'register' : 'login');
                                    setAuthError('');
                                    setUsername('');
                                    setPassword('');
                                }}
                                className="ml-1.5 font-bold text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-700 dark:hover:text-blue-300 transition-colors focus:outline-none"
                            >
                                {authMode === 'login' ? '立即注册' : '直接登录'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
            
            <p className="text-center mt-8 text-xs text-slate-400 dark:text-slate-500">
                &copy; 2026 BetterWriter. All rights reserved.
            </p>
        </motion.div>

        {/* Success Modal */}
        <AnimatePresence>
            {showSuccessModal && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800 text-center relative overflow-hidden"
                    >
                        {/* Decorative background glow */}
                        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-green-500/5 rounded-full blur-[80px] pointer-events-none" />

                        <div className="relative z-10">
                            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-5 ring-8 ring-green-50 dark:ring-green-900/10">
                                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                注册成功！
                            </h3>
                            
                            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed text-sm">
                                您的账号已创建完成。<br/>
                                现在可以使用新账号登录 BetterWriter。
                            </p>
                            
                            <button
                                onClick={() => setShowSuccessModal(false)}
                                className="w-full py-3.5 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-slate-200 dark:shadow-blue-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <span>立即登录</span>
                                <ArrowRight className="w-4 h-4 opacity-60" />
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
};
