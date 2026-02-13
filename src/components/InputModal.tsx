import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { getEyeCareModalBackgroundColor } from '../lib/theme';

interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
}

export const InputModal: React.FC<InputModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  defaultValue = '',
  placeholder = '',
  confirmText = '确定', 
  cancelText = '取消',
}) => {
  const { settings } = useStore();
  const [value, setValue] = useState(() => defaultValue);

  const modalBgColor = getEyeCareModalBackgroundColor(settings);

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onClose();
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
                "rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden ring-1 ring-slate-900/5 dark:ring-slate-100/10 backdrop-blur-xl z-10 relative",
                !modalBgColor && "bg-white/90 dark:bg-slate-900/90"
            )}
            style={{ backgroundColor: modalBgColor }}
          >
            <div className="p-6">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100/80 dark:bg-blue-900/50 mb-4 backdrop-blur-sm">
                  <Edit2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
                {message && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                    {message}
                  </p>
                )}
              </div>
              
              <div className="relative">
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  autoFocus
                  className="w-full px-4 py-3 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm"
                />
              </div>
            </div>
            
            <div className="flex border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-sm">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors border-r border-slate-200/50 dark:border-slate-700/50"
              >
                {cancelText}
              </button>
              <button
                onClick={handleConfirm}
                disabled={!value.trim()}
                className="flex-1 px-4 py-3 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
