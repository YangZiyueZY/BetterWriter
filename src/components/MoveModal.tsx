import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Folder, ArrowRightLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { getEyeCareModalBackgroundColor } from '../lib/theme';

interface MoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string | null;
}

export const MoveModal: React.FC<MoveModalProps> = ({ isOpen, onClose, itemId }) => {
  const { items, moveItem, settings } = useStore();
  const [targetId, setTargetId] = useState<string>('root');

  const itemToMove = items.find(i => i.id === itemId);
  const itemLabel = itemToMove?.type === 'folder' ? '文件夹' : '文件';

  const modalBgColor = getEyeCareModalBackgroundColor(settings);
  
  const getValidDestinations = () => {
      if (!itemToMove) return [];
      
      const descendants = new Set<string>();
      if (itemToMove.type === 'folder') {
          const stack = [itemToMove.id];
          while (stack.length > 0) {
              const currentId = stack.pop()!;
              descendants.add(currentId);
              items.filter(i => i.parentId === currentId).forEach(child => stack.push(child.id));
          }
      }
      
      return items.filter(i => i.type === 'folder' && !descendants.has(i.id));
  };

  const validFolders = getValidDestinations();

  const handleMove = () => {
      if (itemToMove) {
          moveItem(itemToMove.id, targetId === 'root' ? null : targetId);
          onClose();
      }
  };

  return (
    <AnimatePresence>
      {isOpen && itemToMove && (
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
                    "rounded-2xl shadow-2xl w-full max-w-md overflow-hidden ring-1 ring-slate-900/5 dark:ring-slate-100/10 backdrop-blur-xl z-10 relative",
                    !modalBgColor && "bg-white/90 dark:bg-slate-900/90"
                )}
                style={{ backgroundColor: modalBgColor }}
            >
                <div className="p-6">
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100/80 dark:bg-blue-900/50 mb-4 backdrop-blur-sm">
                            <ArrowRightLeft className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                         <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">移动{itemLabel}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            将 <span className="font-medium text-slate-700 dark:text-slate-200">"{itemToMove.name}"</span> 移动到...
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="relative group">
                            <select
                                value={targetId}
                                onChange={(e) => setTargetId(e.target.value)}
                                className="w-full px-4 py-3 pl-10 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none bg-white/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-white/80 dark:hover:bg-slate-900/80"
                            >
                                <option value="root">/ (根目录)</option>
                                {validFolders.map(folder => (
                                    <option key={folder.id} value={folder.id}>
                                        / {folder.name}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none group-hover:text-blue-500 transition-colors">
                                <Folder size={18} />
                            </div>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-sm">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors border-r border-slate-200/50 dark:border-slate-700/50"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleMove}
                        className="flex-1 px-4 py-3 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/30 transition-colors"
                    >
                        移动
                    </button>
                </div>
            </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
