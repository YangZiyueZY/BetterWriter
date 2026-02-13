import React, { useState, useRef, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { FileText, FileCode, Folder, FolderOpen, Plus, Trash2, Settings, ChevronRight, Upload, Edit2, ArrowRightLeft, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { SettingsModal } from './SettingsModal';
import { FileCreationModal } from './FileCreationModal';
import { MoveModal } from './MoveModal';
import { ConfirmModal } from './ConfirmModal';
import { InputModal } from './InputModal';
import { UploadProgressModal } from './UploadProgressModal';
import { Tooltip } from './Tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import type { FileSystemItem } from '../types';

interface FileTreeItemProps {
  item: FileSystemItem;
  level: number;
  items: FileSystemItem[];
  activeFileId: string | null;
  expandedFolders: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onAction: (action: string, id: string) => void;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ 
  item, level, items, activeFileId, expandedFolders, onToggle, onSelect, onAction 
}) => {
  const isExpanded = expandedFolders.has(item.id);
  const children = items.filter(i => i.parentId === item.id);
  // Sort: Folders first, then files, then alphabetical
  children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
  });

  const isActive = item.id === activeFileId;

  return (
    <div>
      <motion.div 
        layout
        initial={false}
        className={cn(
          "group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors duration-200 text-sm mb-1",
          isActive 
            ? "bg-white/60 dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm font-medium border border-blue-100 dark:border-blue-900/30" 
            : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent",
        )}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        onClick={() => item.type === 'folder' ? onToggle(item.id) : onSelect(item.id)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center gap-2.5 truncate flex-1">
          {item.type === 'folder' && (
             <span className={cn("transition-transform duration-200", isExpanded ? "rotate-90" : "")}>
               <ChevronRight size={14} className="text-slate-400 dark:text-slate-500" />
             </span>
          )}
          {item.type === 'folder' ? (
             isExpanded ? <FolderOpen size={18} className="text-blue-500 dark:text-blue-400 flex-shrink-0" /> : <Folder size={18} className="text-blue-400 dark:text-blue-500/80 flex-shrink-0" />
          ) : (
             item.format === 'md' ? <FileCode size={18} className="text-slate-400 dark:text-slate-500 flex-shrink-0" /> : <FileText size={18} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
          )}
          <span className="truncate">{item.name}</span>
        </div>

        {/* Actions - Visible on Hover */}
        <div className={cn(
            "flex items-center gap-1 opacity-0 transition-opacity duration-150",
            "group-hover:opacity-100"
        )}>
            {item.type === 'folder' && (
                <Tooltip content="在此新建">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAction('create_in', item.id); }}
                        className="p-1 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"
                    >
                        <Plus size={14} />
                    </button>
                </Tooltip>
            )}
            <Tooltip content="重命名">
                <button 
                    onClick={(e) => { e.stopPropagation(); onAction('rename', item.id); }}
                    className="p-1 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"
                >
                    <Edit2 size={14} />
                </button>
            </Tooltip>
            <Tooltip content="移动">
                <button 
                    onClick={(e) => { e.stopPropagation(); onAction('move', item.id); }}
                    className="p-1 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"
                >
                    <ArrowRightLeft size={14} />
                </button>
            </Tooltip>
            <Tooltip content="删除">
                <button 
                    onClick={(e) => { e.stopPropagation(); onAction('delete', item.id); }}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                >
                    <Trash2 size={14} />
                </button>
            </Tooltip>
        </div>
      </motion.div>
      
      <AnimatePresence initial={false}>
        {item.type === 'folder' && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="relative overflow-hidden"
          >
            {/* Guide line */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute left-0 top-0 bottom-0 border-l border-slate-200 dark:border-slate-800" 
                style={{ left: `${level * 16 + 19}px` }} 
            />
            {children.length > 0 ? (
               children.map(child => (
                 <FileTreeItem 
                   key={child.id} 
                   item={child} 
                   level={level + 1} 
                   items={items}
                   activeFileId={activeFileId}
                   expandedFolders={expandedFolders}
                   onToggle={onToggle}
                   onSelect={onSelect}
                   onAction={onAction}
                 />
               ))
            ) : (
               <motion.div 
                 initial={{ opacity: 0 }} 
                 animate={{ opacity: 1 }} 
                 className="text-xs text-slate-400 dark:text-slate-600 py-2 italic" 
                 style={{ paddingLeft: `${(level + 1) * 16 + 32}px` }}
               >
                  (空文件夹)
               </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { items, activeFileId, setActiveFile, deleteItem, renameItem, importFile, user } = useStore();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Deduplicate items to prevent key errors from dirty state
  const uniqueItems = useMemo(() => {
    const seen = new Set();
    return items.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [items]);
  
  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [moveItemId, setMoveItemId] = useState<string | null>(null);

  // New Modals state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameInitialValue, setRenameInitialValue] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleFolder = (id: string) => {
    const newSet = new Set(expandedFolders);
    if (newSet.has(id)) {
        newSet.delete(id);
    } else {
        newSet.add(id);
    }
    setExpandedFolders(newSet);
  };

  const handleAction = (action: string, id: string) => {
      if (action === 'delete') {
          setDeleteTargetId(id);
          setIsDeleteConfirmOpen(true);
      } else if (action === 'rename') {
          const item = items.find(i => i.id === id);
          if (item) {
              setRenameTargetId(id);
              setRenameInitialValue(item.name);
              setIsRenameModalOpen(true);
          }
      } else if (action === 'move') {
          setMoveItemId(id);
          setIsMoveOpen(true);
      } else if (action === 'create_in') {
          setCreateParentId(id);
          setIsCreateOpen(true);
      }
  };

  const handleConfirmDelete = () => {
      if (deleteTargetId) {
          deleteItem(deleteTargetId);
          setDeleteTargetId(null);
      }
  };

  const handleConfirmRename = (newName: string) => {
      if (renameTargetId && newName.trim()) {
          renameItem(renameTargetId, newName.trim());
          setRenameTargetId(null);
      }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          const content = ev.target?.result as string;
          importFile(file.name, content, null);
      };
      reader.readAsText(file);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Root items
  const rootItems = uniqueItems.filter(i => i.parentId === null);
  rootItems.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
  });

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <div 
        className={cn(
            "fixed inset-y-0 left-0 z-50 w-72 h-full flex flex-col flex-shrink-0 transition-transform duration-150 transform md:relative md:translate-x-0 border-r border-slate-200/50 dark:border-slate-800/50",
            // Mobile: White Frosted Glass (More transparent)
            "bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl shadow-2xl",
            // Desktop: Transparent to show global background
            "md:bg-white/10 md:dark:bg-slate-950/60 md:backdrop-blur-md md:shadow-none",
            isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Mobile Close Button */}
            <button 
                onClick={onClose}
                className="md:hidden p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
                <X size={20} />
            </button>
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none">
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-lg">{user?.username?.[0]?.toUpperCase() || 'B'}</span>
              )}
            </div>
            <h1 className="font-bold text-xl text-slate-800 dark:text-slate-100 tracking-tight">BetterWriter</h1>
          </div>
          <Tooltip content="系统设置">
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-full transition-all duration-200"
            >
                <Settings size={20} />
            </button>
          </Tooltip>
        </div>
        
        {/* Actions Toolbar */}
        <div className="px-4 pb-4 grid grid-cols-2 gap-3">
            <Tooltip content="创建新文件或文件夹">
                <button
                    onClick={() => { setCreateParentId(null); setIsCreateOpen(true); }}
                    className="flex w-full items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all shadow-sm shadow-blue-200 dark:shadow-none"
                >
                    <Plus size={16} /> 新建
                </button>
            </Tooltip>
            <Tooltip content="从本地导入 Markdown 文件">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 px-3 py-2 bg-white/50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 hover:border-slate-300 active:scale-95 transition-all shadow-sm"
                >
                    <Upload size={16} /> 导入
                </button>
            </Tooltip>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".txt,.md" 
                onChange={handleImport} 
            />
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
            <div className="space-y-1">
              {rootItems.map(item => (
                <FileTreeItem 
                  key={item.id} 
                  item={item} 
                  level={0} 
                  items={uniqueItems}
                  activeFileId={activeFileId}
                  expandedFolders={expandedFolders}
                  onToggle={toggleFolder}
                  onSelect={setActiveFile}
                  onAction={handleAction}
                />
              ))}
              {rootItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-600 gap-2">
                    <FolderOpen size={32} className="opacity-20" />
                    <div className="text-sm font-medium opacity-60">暂无文件</div>
                    <div className="text-xs opacity-40">点击上方按钮创建</div>
                </div>
              )}
            </div>
        </div>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <FileCreationModal 
        key={`create-${isCreateOpen}-${createParentId ?? 'root'}`}
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
        initialParentId={createParentId} 
      />
      <MoveModal 
        key={`move-${isMoveOpen}-${moveItemId ?? 'none'}`}
        isOpen={isMoveOpen} 
        onClose={() => setIsMoveOpen(false)} 
        itemId={moveItemId} 
      />
      
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="删除确认"
        message="确定要删除此项目吗？如果是文件夹，其中的所有内容也将被删除。此操作无法撤销。"
        confirmText="删除"
        cancelText="取消"
        type="danger"
      />

      <InputModal
        key={`rename-${isRenameModalOpen}-${renameTargetId ?? 'none'}-${renameInitialValue}`}
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        onConfirm={handleConfirmRename}
        title="重命名"
        defaultValue={renameInitialValue}
        placeholder="请输入新的名称"
        confirmText="保存"
        cancelText="取消"
      />
      
      <UploadProgressModal />
    </>
  );
};
