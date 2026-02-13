import React, { useEffect } from 'react';
import { useUploadStore } from '../store/useUploadStore';
import { Check, X, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export const UploadProgressModal: React.FC = () => {
  const { tasks, removeTask, clearCompleted } = useUploadStore();

  // Auto-clear completed tasks after 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      clearCompleted();
    }, 3000);
    return () => clearInterval(timer);
  }, [clearCompleted]);

  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      <AnimatePresence>
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            className={cn(
              "bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-3 flex items-center gap-3 overflow-hidden relative",
              task.status === 'error' && "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10"
            )}
          >
            {/* Progress Bar Background */}
            {task.status === 'uploading' && (
              <div 
                className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${task.progress}%` }}
              />
            )}

            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
              task.status === 'completed' ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" :
              task.status === 'error' ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" :
              "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
            )}>
              {task.status === 'completed' ? <Check size={20} /> :
               task.status === 'error' ? <X size={20} /> :
               <ImageIcon size={20} />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate pr-2">
                  {task.fileName}
                </p>
                {task.status === 'uploading' && (
                  <span className="text-xs text-slate-400 font-mono">{Math.round(task.progress)}%</span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {task.status === 'uploading' ? '正在上传...' :
                 task.status === 'completed' ? '上传成功' :
                 task.error || '上传失败'}
              </p>
            </div>

            {task.status !== 'uploading' && (
              <button 
                onClick={() => removeTask(task.id)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
