import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import { Mermaid } from './Mermaid';
import remarkGfm from 'remark-gfm';
import { MathKatex } from './MathKatex';
import { cn } from '../lib/utils';
import { Split, Eye, Edit3, Save, FileType, Menu, Loader2, Check, AlertCircle, HelpCircle, Undo, Redo } from 'lucide-react';
import { MarkdownToolbar } from './MarkdownToolbar';
import { Tooltip } from './Tooltip';
import { insertMarkdown } from '../lib/markdownUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmModal } from './ConfirmModal';
import { sanitizeHref, sanitizeImageSrc } from '../lib/security';
import type { FileItem } from '../types';
import { uploadApi } from '../services/api';
import { useUploadStore } from '../store/useUploadStore';
import { v4 as uuidv4 } from 'uuid';

const resolvePlugin = (plugin: any) => {
  return plugin && typeof plugin.default === 'function' ? plugin.default : plugin;
};

interface EditorProps {
  onToggleSidebar?: () => void;
}

export const Editor: React.FC<EditorProps> = ({ onToggleSidebar }) => {
  const { items, activeFileId, updateFile, renameItem, convertFileFormat, settings, syncFile, checkFileUpdate, token, addFile } = useStore();
  const activeFile = items.find(f => f.id === activeFileId && f.type === 'file') as FileItem | undefined;
  const activeFileKey = activeFile?.id ?? null;
  const activeFileContent = activeFile?.content ?? '';
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('split');
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'success' | 'error' | 'unsynced'>('success');
  const [isSaving, setIsSaving] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { addTask, updateProgress, completeTask, failTask } = useUploadStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
          handleImageUpload(files[0]);
      }
      // Reset input value so the same file can be selected again
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
  };

  // History Management
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUndoRedoAction = useRef(false);
  const historyDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autosaveDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const historyFileIdRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);
  const isSavingRef = useRef(false);
  const contentRef = useRef('');
  const lastSavedContentRef = useRef('');

  // Initialize history when file changes
  useEffect(() => {
    if (!activeFileKey) return;
    if (historyFileIdRef.current === activeFileKey) return;
    historyFileIdRef.current = activeFileKey;
    historyRef.current = [activeFileContent];
    historyIndexRef.current = 0;
    isDirtyRef.current = false;
    lastSavedContentRef.current = activeFileContent;
    setSyncStatus('success');
    if (historyDebounceTimerRef.current) clearTimeout(historyDebounceTimerRef.current);
    if (autosaveDebounceTimerRef.current) clearTimeout(autosaveDebounceTimerRef.current);
  }, [activeFileKey, activeFileContent]);

  useEffect(() => {
    contentRef.current = activeFileContent;
    if (!isDirtyRef.current && lastSavedContentRef.current !== activeFileContent) {
      lastSavedContentRef.current = activeFileContent;
      setSyncStatus('success');
    }
  }, [activeFileContent]);

  const saveToHistory = useCallback((content: string, immediate = false) => {
    if (historyDebounceTimerRef.current) {
        clearTimeout(historyDebounceTimerRef.current);
    }

    const push = () => {
        // Remove any future history
        const currentHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
        // Only push if content is different
        if (currentHistory[currentHistory.length - 1] !== content) {
            historyRef.current = [...currentHistory, content];
            historyIndexRef.current = historyRef.current.length - 1;
            // Limit history size (optional, e.g., 100 steps)
            if (historyRef.current.length > 100) {
                historyRef.current.shift();
                historyIndexRef.current--;
            }
        }
    };

    if (immediate) {
        push();
    } else {
        historyDebounceTimerRef.current = setTimeout(push, 800);
    }
  }, []);

  const handleUndo = () => {
      if (historyIndexRef.current > 0) {
          historyIndexRef.current--;
          const content = historyRef.current[historyIndexRef.current];
          isUndoRedoAction.current = true;
          updateFile(activeFile!.id, content);
      }
  };

  const handleRedo = () => {
      if (historyIndexRef.current < historyRef.current.length - 1) {
          historyIndexRef.current++;
          const content = historyRef.current[historyIndexRef.current];
          isUndoRedoAction.current = true;
          updateFile(activeFile!.id, content);
      }
  };

  // Auto-save simulation visual
  const handleSave = useCallback(() => {
      setIsSaving(true);
      setSyncStatus('syncing');
      isSavingRef.current = true;
      
      // Actual sync to server
      if (activeFileKey) {
        if (!token) {
            isDirtyRef.current = false;
            lastSavedContentRef.current = contentRef.current;
            setIsSaving(false);
            setSyncStatus('success');
            isSavingRef.current = false;
            return;
        }

        syncFile(activeFileKey).then(() => {
            isDirtyRef.current = false;
            lastSavedContentRef.current = contentRef.current;
            setIsSaving(false);
            setSyncStatus('success');
            isSavingRef.current = false;
        }).catch(() => {
            setIsSaving(false);
            setSyncStatus('error');
            isSavingRef.current = false;
        });
      } else {
        // Fallback for visual only if no active file (shouldn't happen)
        setTimeout(() => {
            setIsSaving(false);
            setSyncStatus('success');
            isSavingRef.current = false;
        }, 800);
      }
  }, [activeFileKey, syncFile, token]);

  // Polling for updates
  useEffect(() => {
    if (!activeFileKey) return;
    
    const interval = setInterval(() => {
        if (isDirtyRef.current) return;
        if (isSavingRef.current) return;
        checkFileUpdate(activeFileKey);
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, [activeFileKey, checkFileUpdate]);

  if (!activeFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-slate-50/30 dark:bg-slate-900/30 text-slate-400 dark:text-slate-600">
        <div className="text-center space-y-4">
            <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center mx-auto mb-6">
                <Edit3 size={48} className="text-slate-200 dark:text-slate-700" />
            </div>
            <h3 className="text-2xl font-semibold text-slate-700 dark:text-slate-200">准备好写作了吗？</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto">选择左侧文件或创建一个新文档开始您的创作之旅。</p>
            <div className="pt-2 flex items-center justify-center gap-3">
                <button
                    type="button"
                    onClick={() => onToggleSidebar?.()}
                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800/70 transition-colors"
                >
                    打开侧边栏
                </button>
                <button
                    type="button"
                    onClick={() => addFile('新建文档', 'md', null)}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                    新建文档
                </button>
            </div>
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    updateFile(activeFile.id, newContent);
    
    // Trigger auto-save visual
    isDirtyRef.current = true;
    if (autosaveDebounceTimerRef.current) clearTimeout(autosaveDebounceTimerRef.current);
    setSyncStatus('unsynced'); // Immediate feedback
    autosaveDebounceTimerRef.current = setTimeout(() => {
        if (!isDirtyRef.current) return;
        if (contentRef.current === lastSavedContentRef.current) {
            isDirtyRef.current = false;
            setSyncStatus('success');
            return;
        }
        handleSave();
    }, 2000);

    if (!isUndoRedoAction.current) {
        saveToHistory(newContent, false);
    }
    isUndoRedoAction.current = false;
  };

  const handleInsert = (prefix: string, suffix?: string) => {
    if (textareaRef.current) {
        // Push current state to history before insert if it's not already there (for proper undo of the insert)
        saveToHistory(activeFile.content, true);

        const { value, newCursorStart, newCursorEnd } = insertMarkdown(textareaRef.current, prefix, suffix);
        updateFile(activeFile.id, value);
        saveToHistory(value, true); // Immediate save after tool usage
        
        // Restore cursor/selection
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(newCursorStart, newCursorEnd);
            }
        }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
          const key = e.key.toLowerCase();
          
          switch (key) {
              case 'b':
                  e.preventDefault();
                  handleInsert('**', '**');
                  break;
              case 'i':
                  e.preventDefault();
                  handleInsert('*', '*');
                  break;
              case 'k':
                  e.preventDefault();
                  handleInsert('[', '](url)');
                  break;
              case 's':
                  e.preventDefault();
                  handleSave();
                  break;
              case 'z':
                  e.preventDefault();
                  if (e.shiftKey) {
                      handleRedo();
                  } else {
                      handleUndo();
                  }
                  break;
              case 'y':
                  e.preventDefault();
                  handleRedo();
                  break;
              // case 'c', 'v', 'x', 'a': let native behavior handle these
          }
          
          // Code block
          if (e.shiftKey && key === 'c') {
               e.preventDefault();
               handleInsert('```\n', '\n```');
          }
      }
  };

  const handleConvertFormat = () => {
    setShowConvertModal(true);
  };

  const handleImageUpload = async (file: File) => {
    if (!activeFileKey || activeFile?.format !== 'md') return;

    const taskId = uuidv4();
    addTask(taskId, file.name);

    // 插入占位符
    const placeholder = `![Uploading ${file.name}...]()`;
    handleInsert(placeholder, '');

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await uploadApi.uploadImage(formData, (progressEvent: any) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        updateProgress(taskId, percentCompleted);
      });

      completeTask(taskId);

      // 替换占位符
      if (textareaRef.current) {
        const content = textareaRef.current.value;
        const newContent = content.replace(placeholder, `![${file.name}](${res.url})`);
        updateFile(activeFileKey, newContent);
        // 更新 textarea 值以保持同步
        textareaRef.current.value = newContent;
        // 触发保存
        isDirtyRef.current = true;
        handleSave();
      }
    } catch (error: any) {
      failTask(taskId, error?.response?.data?.message || '上传失败');
      // 替换占位符为错误信息
      if (textareaRef.current) {
        const content = textareaRef.current.value;
        const newContent = content.replace(placeholder, `![Upload Failed: ${file.name}]()`);
        updateFile(activeFileKey, newContent);
        textareaRef.current.value = newContent;
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) handleImageUpload(file);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.indexOf('image') !== -1) {
          handleImageUpload(files[i]);
        }
      }
    }
  };

  const confirmConversion = () => {
      const newFormat = activeFile.format === 'md' ? 'txt' : 'md';
      convertFileFormat(activeFile.id, newFormat);
  };

  const urlTransform = (url: string, key: string) => {
      if (key === 'src') return sanitizeImageSrc(url);
      return sanitizeHref(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent dark:bg-slate-950 relative transition-colors duration-300">
      {/* Toolbar */}
      <div className="h-16 border-b border-slate-100/50 dark:border-slate-800/50 flex items-center justify-between px-4 sm:px-8 bg-white/10 dark:bg-slate-950/60 backdrop-blur-md sticky top-0 z-10 transition-colors duration-300">
        <div className="flex items-center gap-2 sm:gap-4 flex-1">
            <Tooltip content="打开/关闭侧边栏">
                <button 
                    onClick={onToggleSidebar}
                    className="p-2 -ml-2 mr-1 text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-lg md:hidden"
                >
                    <Menu size={20} />
                </button>
            </Tooltip>
            
            <input
                type="text"
                value={activeFile.name}
                onChange={(e) => renameItem(activeFile.id, e.target.value)}
                className="font-bold text-lg sm:text-xl text-slate-800 dark:text-slate-100 focus:outline-none bg-transparent placeholder-slate-300 dark:placeholder-slate-700 w-full max-w-[150px] sm:max-w-md truncate"
                placeholder="无标题文档"
            />
            <div className="flex items-center gap-2">
                <span className={cn(
                    "text-xs font-bold uppercase tracking-wider rounded px-2 py-1 transition-colors hidden sm:inline-block",
                    activeFile.format === 'md' 
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" 
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                )}>
                    {activeFile.format}
                </span>
                <Tooltip content={`转换为 ${activeFile.format === 'md' ? '.txt' : '.md'}`}>
                    <button 
                        onClick={handleConvertFormat}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 transition-all shadow-sm active:scale-95 group"
                    >
                        <FileType size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
                        <span className="hidden sm:inline">转为 {activeFile.format === 'md' ? 'TXT' : 'Markdown'}</span>
                    </button>
                </Tooltip>
            </div>
            
            {/* Mobile Undo/Redo - Only visible on mobile, positioned after format conversion */}
            <div className="flex items-center gap-1 md:hidden">
                <Tooltip content="撤销">
                    <button
                        onClick={handleUndo}
                        className="p-2 text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-full"
                    >
                        <Undo size={18} />
                    </button>
                </Tooltip>
                <Tooltip content="重做">
                    <button
                        onClick={handleRedo}
                        className="p-2 text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-full"
                    >
                        <Redo size={18} />
                    </button>
                </Tooltip>
            </div>

            {isSaving && <span className="text-xs text-blue-400 animate-pulse flex items-center gap-1 font-medium whitespace-nowrap"><Save size={12}/> <span className="hidden sm:inline">已保存</span></span>}
        </div>
        
        <div className="flex items-center gap-3">
            {/* Sync Status Indicator - Integrated into Toolbar */}
            <Tooltip content="点击手动同步到云端">
                <div className="flex items-center" onClick={handleSave}>
                    <div 
                        className="cursor-pointer bg-white/50 dark:bg-slate-800/50 rounded-lg p-1.5 ring-1 ring-slate-200/50 dark:ring-slate-700/50 backdrop-blur-sm"
                    >
                        {syncStatus === 'syncing' && (
                            <Loader2 size={16} className="text-blue-500 animate-spin" />
                        )}
                        {syncStatus === 'success' && (
                            <Check size={16} className="text-emerald-500" />
                        )}
                        {syncStatus === 'error' && (
                            <AlertCircle size={16} className="text-red-500" />
                        )}
                        {syncStatus === 'unsynced' && (
                            <HelpCircle size={16} className="text-amber-500" />
                        )}
                    </div>
                </div>
            </Tooltip>

            <div className="flex items-center bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                <Tooltip content="仅编辑模式">
                    <button 
                        onClick={() => setViewMode('edit')}
                        className={cn(
                            "p-2 rounded-md transition-all duration-200", 
                            viewMode === 'edit' ? "bg-white/60 dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-600/50"
                        )}
                    >
                        <Edit3 size={18} />
                    </button>
                </Tooltip>
                <Tooltip content="分屏模式">
                    <button 
                        onClick={() => setViewMode('split')}
                        className={cn(
                            "p-2 rounded-md transition-all duration-200 hidden md:block", 
                            viewMode === 'split' ? "bg-white/60 dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-600/50"
                        )}
                    >
                        <Split size={18} />
                    </button>
                </Tooltip>
                <Tooltip content="仅预览模式">
                    <button 
                        onClick={() => setViewMode('preview')}
                        className={cn(
                            "p-2 rounded-md transition-all duration-200", 
                            viewMode === 'preview' ? "bg-white/60 dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-600/50"
                        )}
                    >
                        <Eye size={18} />
                    </button>
                </Tooltip>
            </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 flex overflow-hidden relative">
        <AnimatePresence initial={false} mode="popLayout">
          {/* Input Area */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <motion.div 
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={cn(
                    "h-full transition-colors duration-300 flex flex-col bg-transparent dark:bg-slate-950", 
                    viewMode === 'split' ? "w-1/2 border-r border-slate-100 dark:border-slate-800" : "w-full max-w-4xl mx-auto"
                )}
            >
                <textarea
                    ref={textareaRef}
                    className="flex-1 w-full h-full resize-none focus:outline-none font-mono text-slate-700 dark:text-slate-300 p-8 sm:p-10 selection:bg-blue-100 dark:selection:bg-blue-900/30 selection:text-blue-900 dark:selection:text-blue-100 bg-transparent"
                    style={{
                        fontSize: `${settings.fontSize || 16}px`,
                        lineHeight: settings.lineHeight || 1.6,
                        letterSpacing: `${settings.letterSpacing || 0}px`
                    }}
                    value={activeFile.content}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onDrop={handleDrop}
                    placeholder="开始写作..."
                    spellCheck={false}
                />
                {activeFile.format === 'md' && (
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="p-4 bg-white/10 dark:bg-slate-950/60 backdrop-blur-md border-t border-slate-100/50 dark:border-slate-800/50 sticky bottom-0 transition-colors duration-300"
                    >
                        <MarkdownToolbar 
                            onInsert={handleInsert} 
                            onImageUpload={handleImageButtonClick}
                            className="justify-center"
                        />
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleFileInputChange} 
                        />
                    </motion.div>
                )}
            </motion.div>
          )}

          {/* Preview Area */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <motion.div 
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={cn(
                    "h-full overflow-y-auto transition-colors duration-300 bg-white/5 dark:bg-slate-900/50",
                    viewMode === 'split' ? "w-1/2 p-8 sm:p-10" : "w-full max-w-4xl mx-auto p-12 bg-white/40 dark:bg-slate-900/80 shadow-sm my-4 rounded-xl"
                )}
            >
                 <div 
                    className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-4xl prose-h1:tracking-tight prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-img:rounded-xl prose-img:shadow-lg"
                    style={{
                        fontSize: `${settings.fontSize || 16}px`,
                        lineHeight: settings.lineHeight || 1.6,
                        letterSpacing: `${settings.letterSpacing || 0}px`
                    }}
                 >
                    {activeFile.format === 'md' ? (
                        <ReactMarkdown 
                            remarkPlugins={[
                                resolvePlugin(remarkGfm), 
                                resolvePlugin(remarkMath)
                            ]} 
                            urlTransform={urlTransform}
                            components={{
                                code({node, inline, className, children, ...props}: any) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const isMermaid = match && match[1] === 'mermaid';
                                     const isMath =
                                       (className || '').includes('language-math') ||
                                       (className || '').includes('math-inline') ||
                                       (className || '').includes('math-display');
                                     const displayMode = (className || '').includes('math-display') || (!inline && (className || '').includes('language-math'));

                                    if (isMermaid) {
                                        return <Mermaid chart={String(children).replace(/\n$/, '')} />;
                                    }
 
                                     if (isMath) {
                                       return <MathKatex value={String(children)} displayMode={displayMode} />;
                                     }

                                    return !inline && match ? (
                                        <SyntaxHighlighter
                                            style={oneDark}
                                            language={match[1]}
                                            PreTag="div"
                                            {...props}
                                        >
                                            {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                    ) : (
                                        <code className={className} {...props}>
                                            {children}
                                        </code>
                                    );
                                }
                            }}
                        >
                            {activeFile.content || '*无内容*'}
                        </ReactMarkdown>
                    ) : (
                        <pre className="whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-300 bg-transparent border-none p-0 leading-relaxed">
                            {activeFile.content || '无内容'}
                        </pre>
                    )}
                </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Sync Status Indicator (Removed absolute positioning) */}
      <ConfirmModal 
        isOpen={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        onConfirm={confirmConversion}
        title="转换文件格式"
        message={`确定要将当前文件转换为 .${activeFile.format === 'md' ? 'txt' : 'md'} 格式吗？这可能会改变文件的显示效果。`}
        confirmText="确认转换"
      />
    </div>
  );
};
