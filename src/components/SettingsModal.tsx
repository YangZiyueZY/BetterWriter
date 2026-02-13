import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { X, Cloud, HardDrive, Server, Palette, Type, Moon, Image as ImageIcon, Check, ChevronRight, User as UserIcon, LogOut, KeyRound, Lock, Loader2, Eye, EyeOff, Smartphone, RefreshCw, Copy, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from './Tooltip';
import { getEyeCareModalBackgroundColor } from '../lib/theme';
import api, { storageApi, mobileApi, userApi } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EYE_CARE_COLORS = [
  { id: 'galaxy-white', name: '银河白', value: 'rgb(255, 255, 255)' },
  { id: 'mung-bean', name: '绿豆沙', value: 'rgb(199, 237, 204)' },
  { id: 'almond-yellow', name: '杏仁黄', value: 'rgb(250, 249, 222)' },
  { id: 'autumn-brown', name: '秋叶褐', value: 'rgb(255, 242, 226)' },
  { id: 'sky-blue', name: '海天蓝', value: 'rgb(220, 226, 241)' },
  { id: 'aurora-gray', name: '极光灰', value: 'rgb(234, 234, 239)' },
  { id: 'grass-green', name: '青草绿', value: 'rgb(227, 237, 205)' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, user, logout, updateUserAvatar } = useStore();
  const [activeTab, setActiveTab] = useState<'general' | 'storage' | 'account' | 'interface'>('general');
  const [storageError, setStorageError] = useState('');
  const [storageSuccess, setStorageSuccess] = useState('');
  const [isSavingStorage, setIsSavingStorage] = useState(false);
  const [isTestingStorage, setIsTestingStorage] = useState(false);
  const [isSyncingStorage, setIsSyncingStorage] = useState(false);

  // Avatar State
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  // Mobile Interface State
  const [mobileKey, setMobileKey] = useState('');
  const [isLoadingKey, setIsLoadingKey] = useState(false);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Password Change State
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Password Visibility State
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const modalBgColor = getEyeCareModalBackgroundColor(settings);
  const s3Config = settings.s3Config ?? { endpoint: '', bucket: '', accessKey: '', secretKey: '', region: '' };
  const webDavConfig = settings.webDavConfig ?? { url: '', username: '', password: '' };

  const saveStorageSettings = async () => {
    await storageApi.update({
      storageType: settings.storageType,
      s3Config,
      webDavConfig,
    });
  };

  const handleSaveStorage = async () => {
    setStorageError('');
    setStorageSuccess('');
    setIsSavingStorage(true);
    try {
      await saveStorageSettings();

      if (settings.storageType !== 'local') {
        const testResult = await storageApi.test();
        if (!testResult?.ok) {
          setStorageError(testResult?.message || '连接测试失败');
          return;
        }
        await storageApi.syncNow();
        setStorageSuccess('保存成功，已触发同步到云端');
        return;
      }

      setStorageSuccess('保存成功');
    } catch (err: any) {
      setStorageError(err?.response?.data?.message || err?.message || '保存失败');
    } finally {
      setIsSavingStorage(false);
    }
  };

  const handleTestStorage = async () => {
    setStorageError('');
    setStorageSuccess('');
    setIsTestingStorage(true);
    try {
      await saveStorageSettings();
      const testResult = await storageApi.test();
      if (!testResult?.ok) {
        setStorageError(testResult?.message || '连接测试失败');
        return;
      }
      setStorageSuccess('连接测试成功');
    } catch (err: any) {
      setStorageError(err?.response?.data?.message || err?.message || '连接测试失败');
    } finally {
      setIsTestingStorage(false);
    }
  };

  const handleSyncNow = async () => {
    setStorageError('');
    setStorageSuccess('');
    setIsSyncingStorage(true);
    try {
      await saveStorageSettings();
      if (settings.storageType === 'local') {
        setStorageSuccess('当前为服务器本地存储，无需同步');
        return;
      }
      const testResult = await storageApi.test();
      if (!testResult?.ok) {
        setStorageError(testResult?.message || '连接测试失败');
        return;
      }
      const syncResult = await storageApi.syncNow();
      setStorageSuccess(`已触发全量同步（${syncResult?.queued ?? 0} 项）`);
    } catch (err: any) {
      setStorageError(err?.response?.data?.message || err?.message || '同步失败');
    } finally {
      setIsSyncingStorage(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('新密码长度不能少于 6 位');
      return;
    }

    setIsChangingPassword(true);

    try {
      await api.post('/auth/change-password', {
        username: user?.username,
        oldPassword,
        newPassword
      });
      
      setPasswordSuccess('密码修改成功，请重新登录');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Auto logout after 2 seconds
      setTimeout(() => {
        logout();
        onClose();
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || '密码修改失败，请检查旧密码是否正确');
    } finally {
      setIsChangingPassword(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'interface' && isOpen) {
      const fetchKey = async () => {
        setIsLoadingKey(true);
        try {
          const data = await mobileApi.getKey();
          setMobileKey(data.mobileKey);
        } catch (err) {
          console.error('Failed to fetch mobile key', err);
        } finally {
          setIsLoadingKey(false);
        }
      };
      fetchKey();
    }
  }, [activeTab, isOpen]);

  const handleRegenerateKey = async () => {
    setIsRegeneratingKey(true);
    try {
      const data = await mobileApi.regenerateKey();
      setMobileKey(data.mobileKey);
    } catch (err) {
      console.error('Failed to regenerate key', err);
    } finally {
      setIsRegeneratingKey(false);
    }
  };

  const copyToClipboard = () => {
    const url = `http://${window.location.hostname}:3001/api/mobile/sync/${mobileKey}`;
    navigator.clipboard.writeText(url);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('图片大小不能超过 5MB');
      return;
    }

    setAvatarError('');
    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await userApi.uploadAvatar(formData);
      updateUserAvatar(res.avatar);
    } catch (err: any) {
      setAvatarError(err?.response?.data?.error || '上传失败，请重试');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleAvatarUrlUpdate = async (url: string) => {
    try {
      await userApi.updateProfile({ avatar: url });
      updateUserAvatar(url);
    } catch (err) {
      console.error('Update avatar url failed', err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className={cn(
                "rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] md:h-[85vh] overflow-hidden flex flex-col ring-1 ring-slate-900/5 dark:ring-slate-100/10 backdrop-blur-md z-10",
                !modalBgColor && "bg-white/95 dark:bg-slate-900/95"
            )}
            style={{ backgroundColor: modalBgColor }}
          >
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">设置</h2>
              <Tooltip content="关闭设置">
                <button 
                  onClick={onClose} 
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-200"
                >
                  <X size={20} />
                </button>
              </Tooltip>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              {/* Sidebar */}
              <div className="w-full md:w-64 bg-slate-50/60 dark:bg-slate-950/60 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 p-2 md:p-4 flex md:flex-col gap-2 md:space-y-2 backdrop-blur-sm overflow-x-auto">
                 <button
                   onClick={() => setActiveTab('general')}
                   className={cn(
                     "flex-1 md:flex-none md:w-full flex items-center justify-center md:justify-between px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-all duration-200 group whitespace-nowrap",
                     activeTab === 'general' 
                        ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                   )}
                 >
                   <div className="flex items-center gap-2 md:gap-3">
                     <Palette size={18} className={cn("transition-colors", activeTab === 'general' ? "text-blue-500 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600")} />
                     <span>页面基础设置</span>
                   </div>
                   {activeTab === 'general' && <ChevronRight size={14} className="hidden md:block text-blue-400/50" />}
                 </button>
                 
                 <button
                   onClick={() => setActiveTab('storage')}
                   className={cn(
                     "flex-1 md:flex-none md:w-full flex items-center justify-center md:justify-between px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-all duration-200 group whitespace-nowrap",
                     activeTab === 'storage' 
                        ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                   )}
                 >
                   <div className="flex items-center gap-2 md:gap-3">
                     <Cloud size={18} className={cn("transition-colors", activeTab === 'storage' ? "text-blue-500 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600")} />
                     <span>存储与同步</span>
                   </div>
                   {activeTab === 'storage' && <ChevronRight size={14} className="hidden md:block text-blue-400/50" />}
                 </button>

                 <button
                   onClick={() => setActiveTab('account')}
                   className={cn(
                     "flex-1 md:flex-none md:w-full flex items-center justify-center md:justify-between px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-all duration-200 group whitespace-nowrap",
                     activeTab === 'account' 
                        ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                   )}
                 >
                   <div className="flex items-center gap-2 md:gap-3">
                     <UserIcon size={18} className={cn("transition-colors", activeTab === 'account' ? "text-blue-500 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600")} />
                     <span>账户</span>
                   </div>
                   {activeTab === 'account' && <ChevronRight size={14} className="hidden md:block text-blue-400/50" />}
                 </button>

                 <button
                   onClick={() => setActiveTab('interface')}
                   className={cn(
                     "flex-1 md:flex-none md:w-full flex items-center justify-center md:justify-between px-4 py-2 md:py-3 rounded-xl text-sm font-medium transition-all duration-200 group whitespace-nowrap",
                     activeTab === 'interface' 
                        ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                   )}
                 >
                   <div className="flex items-center gap-2 md:gap-3">
                     <Smartphone size={18} className={cn("transition-colors", activeTab === 'interface' ? "text-blue-500 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600")} />
                     <span>接口</span>
                   </div>
                   {activeTab === 'interface' && <ChevronRight size={14} className="hidden md:block text-blue-400/50" />}
                 </button>
              </div>
    
              {/* Content */}
              <div className="flex-1 overflow-y-auto bg-white/30 dark:bg-slate-900/30 relative">
                <AnimatePresence mode="wait">
                {activeTab === 'general' ? (
                    <motion.div 
                        key="general"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="p-8 max-w-2xl mx-auto space-y-8 absolute inset-0 overflow-y-auto"
                    >
                        
                        {/* Background Settings Card */}
                        <section className="bg-white/60 dark:bg-slate-800/40 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 backdrop-blur-sm">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                <ImageIcon size={20} className="text-blue-500" /> 
                                <span>背景设置</span>
                            </h3>
                            
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        <span>护眼纯色背景</span>
                                        {settings.darkMode && <span className="text-xs text-amber-500 font-normal bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-100 dark:border-amber-900/50">深色模式下不生效</span>}
                                    </label>
                                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                                        {EYE_CARE_COLORS.map((color) => (
                                            <Tooltip key={color.id} content={color.name}>
                                                <button
                                                    onClick={() => updateSettings({ backgroundColor: color.value, backgroundImage: '' })}
                                                    className={cn(
                                                        "group relative h-10 w-full rounded-full border transition-all hover:scale-110 active:scale-95 shadow-sm",
                                                        "border-slate-200 dark:border-slate-600",
                                                        settings.backgroundColor === color.value && !settings.backgroundImage 
                                                            ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 scale-110 z-10" 
                                                            : "hover:border-slate-300 dark:hover:border-slate-500"
                                                    )}
                                                    style={{ backgroundColor: color.value }}
                                                >
                                                    {settings.backgroundColor === color.value && !settings.backgroundImage && (
                                                        <div className="absolute inset-0 flex items-center justify-center animate-in zoom-in duration-200">
                                                            <Check size={14} className="text-slate-800/80" strokeWidth={3} />
                                                        </div>
                                                    )}
                                                </button>
                                            </Tooltip>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">自定义背景图片</label>
                                    <div className="relative group">
                                        <input 
                                            type="text" 
                                            value={settings.backgroundImage || ''}
                                            onChange={(e) => updateSettings({ backgroundImage: e.target.value })}
                                            placeholder="输入图片 URL (例如 https://example.com/bg.jpg)"
                                            className="w-full px-4 py-3 pl-10 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/70 dark:bg-slate-950/70 dark:text-slate-100 shadow-sm group-hover:bg-white dark:group-hover:bg-slate-950"
                                        />
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                            <ImageIcon size={16} />
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 pl-1">
                                        输入链接后将优先显示图片。清空链接可恢复纯色背景。
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Theme Settings Card */}
                        <section className="bg-white/60 dark:bg-slate-800/40 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 backdrop-blur-sm">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                <Moon size={20} className="text-indigo-500" /> 
                                <span>主题设置</span>
                            </h3>
                            <div className="flex items-center justify-between p-4 border border-slate-200/60 dark:border-slate-700/60 rounded-xl bg-white/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 transition-colors cursor-pointer" onClick={() => updateSettings({ darkMode: !settings.darkMode })}>
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">深色模式</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">切换到深色外观以减轻眼部疲劳</span>
                                </div>
                                <button
                                    className={cn(
                                        "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                                        settings.darkMode ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                                    )}
                                >
                                    <motion.span
                                        layout
                                        className={cn(
                                            "inline-block h-5 w-5 transform rounded-full bg-white shadow-md"
                                        )}
                                        animate={{ x: settings.darkMode ? 24 : 4 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                </button>
                            </div>
                        </section>

                        {/* Font Settings Card */}
                        <section className="bg-white/60 dark:bg-slate-800/40 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 backdrop-blur-sm">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                <Type size={20} className="text-rose-500" /> 
                                <span>字体样式</span>
                            </h3>
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">字体选择</label>
                                    <div className="relative group">
                                        <select
                                            value={settings.fontFamily === 'MaokenAssortedSans' ? 'MaokenAssortedSans' : 'default'}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === 'default') {
                                                    updateSettings({ fontFamily: 'Inter, system-ui, sans-serif' });
                                                } else if (val === 'MaokenAssortedSans') {
                                                    updateSettings({ fontFamily: 'MaokenAssortedSans' });
                                                }
                                            }}
                                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/70 dark:bg-slate-950/70 dark:text-slate-100 appearance-none cursor-pointer shadow-sm group-hover:bg-white dark:group-hover:bg-slate-950"
                                        >
                                            <option value="default" className="bg-white dark:bg-slate-950">系统默认字体</option>
                                            <option value="MaokenAssortedSans" className="bg-white dark:bg-slate-950">猫啃什锦黑 (艺术字体)</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500 dark:text-slate-400">
                                            <Type size={16} />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">自定义 CSS 字体</label>
                                    <input 
                                        type="text" 
                                        value={settings.fontFamily || ''}
                                        onChange={(e) => updateSettings({ fontFamily: e.target.value })}
                                        placeholder="例如 'Inter', sans-serif"
                                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/70 dark:bg-slate-950/70 dark:text-slate-100 shadow-sm focus:bg-white dark:focus:bg-slate-950"
                                    />
                                </div>

                                {/* Font Size Settings */}
                                <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                            字体大小 ({settings.fontSize}px)
                                        </label>
                                    </div>
                                    <input
                                        type="range"
                                        min="12"
                                        max="32"
                                        step="1"
                                        value={settings.fontSize}
                                        onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-blue-500"
                                    />
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>小 (12px)</span>
                                        <span>标准 (16px)</span>
                                        <span>大 (32px)</span>
                                    </div>
                                </div>

                                {/* Line Height Settings */}
                                <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                            行高 ({settings.lineHeight})
                                        </label>
                                    </div>
                                    <input
                                        type="range"
                                        min="1.0"
                                        max="3.0"
                                        step="0.1"
                                        value={settings.lineHeight}
                                        onChange={(e) => updateSettings({ lineHeight: parseFloat(e.target.value) })}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-blue-500"
                                    />
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>紧凑 (1.0)</span>
                                        <span>标准 (1.6)</span>
                                        <span>宽松 (3.0)</span>
                                    </div>
                                </div>

                                {/* Letter Spacing Settings */}
                                <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                            字间距 ({settings.letterSpacing}px)
                                        </label>
                                    </div>
                                    <input
                                        type="range"
                                        min="-2"
                                        max="10"
                                        step="0.5"
                                        value={settings.letterSpacing}
                                        onChange={(e) => updateSettings({ letterSpacing: parseFloat(e.target.value) })}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-blue-500"
                                    />
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>紧缩 (-2px)</span>
                                        <span>标准 (0px)</span>
                                        <span>宽敞 (10px)</span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </motion.div>
                ) : activeTab === 'storage' ? (
                  <motion.div 
                    key="storage"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="p-8 max-w-2xl mx-auto space-y-8 absolute inset-0 overflow-y-auto"
                  >
                    <section className="bg-white/60 dark:bg-slate-800/40 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 backdrop-blur-sm">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                         <HardDrive size={20} className="text-emerald-500" />
                         <span>存储方式</span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <button
                          onClick={() => updateSettings({ storageType: 'local' })}
                          className={cn(
                            "flex flex-col items-center gap-4 p-5 border rounded-2xl transition-all duration-300 hover:shadow-lg active:scale-95 group",
                            settings.storageType === 'local' 
                                ? "border-blue-500 bg-blue-50/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-500 shadow-md" 
                                : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-white/50 dark:bg-slate-950/50"
                          )}
                        >
                          <div className={cn("p-3 rounded-full transition-colors", settings.storageType === 'local' ? "bg-blue-100 dark:bg-blue-900/50" : "bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-slate-700")}>
                            <HardDrive size={24} className={settings.storageType === 'local' ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"} />
                          </div>
                          <span className="text-sm font-bold">服务器本地</span>
                        </button>
                        <button
                          onClick={() => updateSettings({ storageType: 's3' })}
                          className={cn(
                            "flex flex-col items-center gap-4 p-5 border rounded-2xl transition-all duration-300 hover:shadow-lg active:scale-95 group",
                            settings.storageType === 's3' 
                                ? "border-blue-500 bg-blue-50/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-500 shadow-md" 
                                : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-white/50 dark:bg-slate-950/50"
                          )}
                        >
                          <div className={cn("p-3 rounded-full transition-colors", settings.storageType === 's3' ? "bg-blue-100 dark:bg-blue-900/50" : "bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-slate-700")}>
                            <Cloud size={24} className={settings.storageType === 's3' ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"} />
                          </div>
                          <span className="text-sm font-bold">AWS S3</span>
                        </button>
                        <button
                          onClick={() => updateSettings({ storageType: 'webdav' })}
                          className={cn(
                            "flex flex-col items-center gap-4 p-5 border rounded-2xl transition-all duration-300 hover:shadow-lg active:scale-95 group",
                            settings.storageType === 'webdav' 
                                ? "border-blue-500 bg-blue-50/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-500 shadow-md" 
                                : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-white/50 dark:bg-slate-950/50"
                          )}
                        >
                          <div className={cn("p-3 rounded-full transition-colors", settings.storageType === 'webdav' ? "bg-blue-100 dark:bg-blue-900/50" : "bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-slate-700")}>
                             <Server size={24} className={settings.storageType === 'webdav' ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"} />
                          </div>
                          <span className="text-sm font-bold">WebDAV</span>
                        </button>
                      </div>
                    </section>

                    {settings.storageType === 's3' && (
                      <section className="bg-white/60 dark:bg-slate-800/40 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-300">
                        <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-6">
                            <Cloud size={18} className="text-blue-500" /> S3 详细配置
                        </h4>
                        <div className="space-y-5">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Endpoint</label>
                            <input 
                              type="text" 
                              value={s3Config.endpoint}
                              onChange={(e) => updateSettings({ s3Config: { ...s3Config, endpoint: e.target.value } })}
                              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/70 dark:bg-slate-950/70 dark:text-slate-100 shadow-sm"
                              placeholder="https://s3.amazonaws.com 或 http://127.0.0.1:9000"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Bucket</label>
                              <input 
                                type="text" 
                                value={s3Config.bucket}
                                onChange={(e) => updateSettings({ s3Config: { ...s3Config, bucket: e.target.value } })}
                                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/70 dark:bg-slate-950/70 dark:text-slate-100 shadow-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Region</label>
                              <input 
                                type="text" 
                                value={s3Config.region}
                                onChange={(e) => updateSettings({ s3Config: { ...s3Config, region: e.target.value } })}
                                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/70 dark:bg-slate-950/70 dark:text-slate-100 shadow-sm"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Access Key</label>
                            <input 
                              type="password" 
                              value={s3Config.accessKey}
                              onChange={(e) => updateSettings({ s3Config: { ...s3Config, accessKey: e.target.value } })}
                              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/70 dark:bg-slate-950/70 dark:text-slate-100 shadow-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Secret Key</label>
                            <input 
                              type="password" 
                              value={s3Config.secretKey}
                              onChange={(e) => updateSettings({ s3Config: { ...s3Config, secretKey: e.target.value } })}
                              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/70 dark:bg-slate-950/70 dark:text-slate-100 shadow-sm"
                            />
                          </div>
                        </div>
                      </section>
                    )}
                    
                    {settings.storageType === 'webdav' && (
                      <section className="bg-white/60 dark:bg-slate-800/40 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-300">
                        <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-6">
                            <Server size={18} className="text-blue-500" /> WebDAV 详细配置
                        </h4>
                         <div className="space-y-5">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Server URL</label>
                            <input 
                              type="text" 
                              value={webDavConfig.url}
                              onChange={(e) => updateSettings({ webDavConfig: { ...webDavConfig, url: e.target.value } })}
                              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/70 dark:bg-slate-950/70 dark:text-slate-100 shadow-sm"
                              placeholder="https://example.com/dav 或 http://127.0.0.1:8080/dav"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Username</label>
                            <input 
                              type="text" 
                              value={webDavConfig.username}
                              onChange={(e) => updateSettings({ webDavConfig: { ...webDavConfig, username: e.target.value } })}
                              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/70 dark:bg-slate-950/70 dark:text-slate-100 shadow-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Password</label>
                            <input 
                              type="password" 
                              value={webDavConfig.password}
                              onChange={(e) => updateSettings({ webDavConfig: { ...webDavConfig, password: e.target.value } })}
                              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/70 dark:bg-slate-950/70 dark:text-slate-100 shadow-sm"
                            />
                          </div>
                        </div>
                      </section>
                    )}

                    <section className="bg-white/60 dark:bg-slate-800/40 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 backdrop-blur-sm">
                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
                        <HardDrive size={18} className="text-emerald-500" /> 保存与同步
                      </h4>

                      <AnimatePresence mode="wait">
                        {storageError && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-3 flex items-center gap-3 text-sm text-red-600 dark:text-red-300 mb-4"
                          >
                            <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                            {storageError}
                          </motion.div>
                        )}
                        {storageSuccess && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-3 flex items-center gap-3 text-sm text-emerald-700 dark:text-emerald-300 mb-4"
                          >
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                            {storageSuccess}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={handleSaveStorage}
                          disabled={isSavingStorage || isTestingStorage || isSyncingStorage}
                          className="flex-1 px-4 py-3 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {(isSavingStorage) ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>保存中...</span>
                            </>
                          ) : (
                            <span>保存设置</span>
                          )}
                        </button>
                        <button
                          onClick={handleTestStorage}
                          disabled={isSavingStorage || isTestingStorage || isSyncingStorage}
                          className="flex-1 px-4 py-3 bg-white/80 dark:bg-slate-950/60 hover:bg-white dark:hover:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl font-bold shadow-sm hover:shadow active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2"
                        >
                          {(isTestingStorage) ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>测试中...</span>
                            </>
                          ) : (
                            <span>测试连接</span>
                          )}
                        </button>
                        <button
                          onClick={handleSyncNow}
                          disabled={isSavingStorage || isTestingStorage || isSyncingStorage}
                          className="flex-1 px-4 py-3 bg-white/80 dark:bg-slate-950/60 hover:bg-white dark:hover:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl font-bold shadow-sm hover:shadow active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2"
                        >
                          {(isSyncingStorage) ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>同步中...</span>
                            </>
                          ) : (
                            <span>立即同步</span>
                          )}
                        </button>
                      </div>
                    </section>

                  </motion.div>
                ) : activeTab === 'interface' ? (
                  <motion.div 
                    key="interface"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="p-8 max-w-2xl mx-auto space-y-8 absolute inset-0 overflow-y-auto"
                  >
                    <section className="bg-white/60 dark:bg-slate-800/40 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 backdrop-blur-sm">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                         <Smartphone size={20} className="text-blue-500" />
                         <span>移动端接口</span>
                      </h3>
                      
                      <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-200">
                          <p className="flex gap-2">
                            <span className="shrink-0">ℹ️</span>
                            <span>此接口用于移动端 APP 连接您的账户并同步数据。请妥善保管此链接，不要分享给他人。</span>
                          </p>
                        </div>

                        <div className="space-y-3">
                          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            专属调用接口 (Unique Interface URL)
                          </label>
                          
                          <div className="relative group">
                            <div className="w-full px-4 py-3 pr-24 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-mono break-all">
                              {isLoadingKey ? (
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>加载中...</span>
                                </div>
                              ) : (
                                `http://${window.location.hostname}:3001/api/mobile/sync/${mobileKey}`
                              )}
                            </div>
                            
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                              <Tooltip content={copySuccess ? "复制成功" : "复制链接"}>
                                <button
                                  onClick={copyToClipboard}
                                  disabled={isLoadingKey || !mobileKey}
                                  className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                  {copySuccess ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                                </button>
                              </Tooltip>
                            </div>
                          </div>
                          
                          <div className="flex justify-end pt-2">
                             <button
                                onClick={handleRegenerateKey}
                                disabled={isRegeneratingKey || isLoadingKey}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                             >
                                <RefreshCw size={14} className={cn(isRegeneratingKey && "animate-spin")} />
                                <span>重置接口密钥</span>
                             </button>
                          </div>
                        </div>
                      </div>
                    </section>
                  </motion.div>
                ) : (
                    <motion.div 
                        key="account"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="p-8 max-w-2xl mx-auto space-y-8 absolute inset-0 overflow-y-auto"
                    >
                        <section className="bg-white/60 dark:bg-slate-800/40 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 backdrop-blur-sm">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                <UserIcon size={20} className="text-purple-500" /> 
                                <span>账户信息</span>
                            </h3>

                            {user ? (
                                <div className="space-y-6">
                                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <div className="relative group shrink-0">
                                            <div className="h-24 w-24 rounded-full overflow-hidden bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-lg">
                                                {user.avatar ? (
                                                    <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-purple-600 dark:text-purple-400 font-bold text-4xl">
                                                        {user.username.charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <button 
                                                onClick={() => avatarInputRef.current?.click()}
                                                className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 transition-colors"
                                                disabled={isUploadingAvatar}
                                            >
                                                {isUploadingAvatar ? <Loader2 size={16} className="animate-spin" /> : <Edit2 size={16} />}
                                            </button>
                                            <input 
                                                type="file" 
                                                ref={avatarInputRef} 
                                                className="hidden" 
                                                accept="image/*" 
                                                onChange={handleAvatarUpload}
                                            />
                                        </div>
                                        
                                        <div className="flex-1 space-y-4 w-full text-center sm:text-left">
                                            <div>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">当前登录账户</p>
                                                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{user.username}</p>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                    头像链接
                                                </label>
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="text" 
                                                        placeholder="输入图片 URL" 
                                                        defaultValue={user.avatar?.startsWith('http') ? user.avatar : ''}
                                                        onBlur={(e) => {
                                                            const val = e.target.value;
                                                            if (val && val !== user.avatar) {
                                                                handleAvatarUrlUpdate(val);
                                                            }
                                                        }}
                                                        className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white/70 dark:bg-slate-950/70 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    />
                                                </div>
                                                {avatarError && <p className="text-xs text-red-500">{avatarError}</p>}
                                                <p className="text-xs text-slate-400">支持上传本地图片 (最大 5MB) 或输入直链。若配置了云存储，上传的头像也会同步。</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <button
                                        onClick={() => {
                                            logout();
                                            onClose();
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-semibold"
                                    >
                                        <LogOut size={18} />
                                        退出登录
                                    </button>

                                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                                        <button 
                                            onClick={() => setShowPasswordChange(!showPasswordChange)}
                                            className="flex items-center justify-between w-full text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                        >
                                            <span className="flex items-center gap-2">
                                                <KeyRound size={18} />
                                                修改密码
                                            </span>
                                            <ChevronRight size={16} className={cn("transition-transform duration-200", showPasswordChange ? "rotate-90" : "")} />
                                        </button>

                                        <AnimatePresence>
                                            {showPasswordChange && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <form onSubmit={handleChangePassword} className="pt-4 space-y-4">
                                                        {passwordError && (
                                                            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-300 rounded-lg flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                                                {passwordError}
                                                            </div>
                                                        )}
                                                        {passwordSuccess && (
                                                            <div className="p-3 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300 rounded-lg flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                                {passwordSuccess}
                                                            </div>
                                                        )}

                                                        <div className="space-y-3">
                                                            <div className="relative group">
                                                                <input 
                                                                    type={showOldPassword ? "text" : "password"}
                                                                    value={oldPassword}
                                                                    onChange={(e) => setOldPassword(e.target.value)}
                                                                    placeholder="当前密码"
                                                                    className="w-full px-4 py-3 pl-10 pr-10 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/70 dark:bg-slate-950/70 dark:text-slate-100 shadow-sm"
                                                                    required
                                                                />
                                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowOldPassword(!showOldPassword)}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none transition-colors"
                                                                >
                                                                    {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                </button>
                                                            </div>
                                                            <div className="relative group">
                                                                <input 
                                                                    type={showNewPassword ? "text" : "password"}
                                                                    value={newPassword}
                                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                                    placeholder="新密码 (至少 6 位)"
                                                                    className="w-full px-4 py-3 pl-10 pr-10 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/70 dark:bg-slate-950/70 dark:text-slate-100 shadow-sm"
                                                                    required
                                                                />
                                                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none transition-colors"
                                                                >
                                                                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                </button>
                                                            </div>
                                                            <div className="relative group">
                                                                <input 
                                                                    type={showConfirmPassword ? "text" : "password"}
                                                                    value={confirmPassword}
                                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                                    placeholder="确认新密码"
                                                                    className="w-full px-4 py-3 pl-10 pr-10 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/70 dark:bg-slate-950/70 dark:text-slate-100 shadow-sm"
                                                                    required
                                                                />
                                                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none transition-colors"
                                                                >
                                                                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <button 
                                                            type="submit" 
                                                            disabled={isChangingPassword}
                                                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                        >
                                                            {isChangingPassword ? (
                                                                <>
                                                                    <Loader2 size={16} className="animate-spin" />
                                                                    <span>更新中...</span>
                                                                </>
                                                            ) : (
                                                                <span>确认修改</span>
                                                            )}
                                                        </button>
                                                    </form>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                                    <p>请重新加载应用进行登录</p>
                                </div>
                            )}
                        </section>
                    </motion.div>
                )}
                </AnimatePresence>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-sm">
                <button onClick={onClose} className="px-8 py-3 bg-slate-900 dark:bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-slate-800 dark:hover:bg-blue-500 transition-all shadow-md hover:shadow-lg active:scale-95">
                    完成设置
                </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
