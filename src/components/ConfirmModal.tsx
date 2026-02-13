import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { getEyeCareModalBackgroundColor } from '../lib/theme';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info' | 'warning';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = '确定', 
  cancelText = '取消',
  type = 'warning'
}) => {
  const { settings } = useStore();
  
  const modalBgColor = getEyeCareModalBackgroundColor(settings);

  const isDanger = type === 'danger';

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
            <div className="p-6 text-center">
              <div className={cn(
                  "mx-auto flex h-12 w-12 items-center justify-center rounded-full mb-4 backdrop-blur-sm",
                  isDanger ? "bg-red-100/80 dark:bg-red-900/50" : "bg-blue-100/80 dark:bg-blue-900/50"
              )}>
                <AlertTriangle className={cn("h-6 w-6", isDanger ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400")} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {message}
              </p>
            </div>
            <div className="flex border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-sm">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors border-r border-slate-200/50 dark:border-slate-700/50"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={cn(
                    "flex-1 px-4 py-3 text-sm font-bold transition-colors",
                    isDanger 
                        ? "text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/30" 
                        : "text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/30"
                )}
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
