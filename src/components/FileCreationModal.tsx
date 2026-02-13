import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { X, Folder, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

interface FileCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialParentId: string | null;
}

export const FileCreationModal: React.FC<FileCreationModalProps> = ({ isOpen, onClose, initialParentId }) => {
  const { items, addFile, createFolder } = useStore();
  const [name, setName] = useState('');
  const [type, setType] = useState<'file' | 'folder'>('file');
  const [format, setFormat] = useState<'txt' | 'md'>('md');
  const [parentId, setParentId] = useState<string>(initialParentId || 'root'); // 'root' as special value for null

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalParentId = parentId === 'root' ? null : parentId;

    if (type === 'file') {
        addFile(name, format, finalParentId);
    } else {
        createFolder(name, finalParentId);
    }
    onClose();
  };

  const folders = items.filter(i => i.type === 'folder');

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-all">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden ring-1 ring-slate-900/5 dark:ring-slate-100/10">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">新建</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Type Selection */}
            <div className="flex bg-slate-100/50 dark:bg-slate-800 p-1.5 rounded-xl">
                <button
                    type="button"
                    onClick={() => setType('file')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                        type === 'file' 
                            ? "bg-white/80 dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    )}
                >
                    <FileText size={18} /> 文件
                </button>
                <button
                    type="button"
                    onClick={() => setType('folder')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                        type === 'folder' 
                            ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" 
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    )}
                >
                    <Folder size={18} /> 文件夹
                </button>
            </div>

            {/* Name Input */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {type === 'file' ? '文件名称' : '文件夹名称'}
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    placeholder={type === 'file' ? "例如：我的笔记" : "例如：工作资料"}
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white/50 dark:bg-slate-950 dark:text-slate-100"
                />
            </div>

            {/* File Format Selection (Only for files) */}
            {type === 'file' && (
                <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">格式</label>
                    <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative flex items-center">
                                <input
                                    type="radio"
                                    name="format"
                                    checked={format === 'md'}
                                    onChange={() => setFormat('md')}
                                    className="peer h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-600"
                                />
                            </div>
                            <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">Markdown (.md)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative flex items-center">
                                <input
                                    type="radio"
                                    name="format"
                                    checked={format === 'txt'}
                                    onChange={() => setFormat('txt')}
                                    className="peer h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-600"
                                />
                            </div>
                            <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">纯文本 (.txt)</span>
                        </label>
                    </div>
                </div>
            )}

            {/* Parent Folder Selection */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">位置</label>
                <div className="relative">
                    <select
                        value={parentId}
                        onChange={(e) => setParentId(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none bg-white dark:bg-slate-950 dark:text-slate-100"
                    >
                        <option value="root">/ (根目录)</option>
                        {folders.map(folder => (
                            <option key={folder.id} value={folder.id}>
                                / {folder.name}
                            </option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500 dark:text-slate-400">
                        <Folder size={16} />
                    </div>
                </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                    取消
                </button>
                <button
                    type="submit"
                    disabled={!name.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95 transition-all"
                >
                    创建
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};
