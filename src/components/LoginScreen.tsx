import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { User, Lock, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

export const LoginScreen: React.FC = () => {
  const { login, fetchFiles } = useStore();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);

    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const res = await api.post(endpoint, { username, password });
      
      if (authMode === 'login') {
          // Success: Store updates will trigger App re-render to main screen
          login(res.data.user, res.data.token);
          fetchFiles(); // Sync files after login
      } else {
          setAuthMode('login');
          setAuthError('');
          alert('注册成功，请登录');
          setUsername('');
          setPassword('');
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || '认证失败，请检查用户名或密码');
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
                                <div className="relative group">
                                    <input 
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3.5 pl-11 pr-11 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm group-hover:bg-white dark:group-hover:bg-slate-950"
                                        placeholder="请输入密码"
                                        required
                                    />
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
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
    </div>
  );
};
