import React from 'react';
import { 
  Bold, Italic, Heading1, Heading2, Heading3, 
  Quote, Code, Link, List, ListOrdered, Table, Image,
  Strikethrough, Minus, CheckSquare, Terminal,
  Highlighter, Sigma, Variable, Activity, GitGraph
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { Tooltip } from './Tooltip';

interface MarkdownToolbarProps {
  onInsert: (prefix: string, suffix?: string) => void;
  onImageUpload?: () => void;
  className?: string;
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ onInsert, onImageUpload, className }) => {
  const tools = [
    { id: 'bold', icon: Bold, label: '加粗', prefix: '**', suffix: '**', desc: '粗体文本' },
    { id: 'italic', icon: Italic, label: '斜体', prefix: '*', suffix: '*', desc: '斜体文本' },
    { id: 'strike', icon: Strikethrough, label: '删除线', prefix: '~~', suffix: '~~', desc: '删除线文本' },
    { id: 'highlight', icon: Highlighter, label: '高亮', prefix: '==', suffix: '==', desc: '文本高亮' },
    { id: 'h1', icon: Heading1, label: '一级标题', prefix: '# ', suffix: '', desc: '一级标题' },
    { id: 'h2', icon: Heading2, label: '二级标题', prefix: '## ', suffix: '', desc: '二级标题' },
    { id: 'h3', icon: Heading3, label: '三级标题', prefix: '### ', suffix: '', desc: '三级标题' },
    { id: 'quote', icon: Quote, label: '引用', prefix: '> ', suffix: '', desc: '引用块' },
    { id: 'inline-code', icon: Terminal, label: '行内代码', prefix: '`', suffix: '`', desc: '行内代码' },
    { id: 'code-block', icon: Code, label: '代码块', prefix: '```\n', suffix: '\n```', desc: '多行代码块' },
    { id: 'math-inline', icon: Sigma, label: '行内公式', prefix: '$', suffix: '$', desc: 'KaTeX 数学公式' },
    { id: 'math-block', icon: Variable, label: '块级公式', prefix: '$$\n', suffix: '\n$$', desc: '块级数学公式' },
    { id: 'link', icon: Link, label: '链接', prefix: '[', suffix: '](url)', desc: '插入超链接' },
    { id: 'image', icon: Image, label: '图片', prefix: '![', suffix: '](url)', isUpload: true, desc: '上传/插入图片' },
    { id: 'mermaid', icon: Activity, label: 'Mermaid', prefix: '```mermaid\n', suffix: '\n```', desc: '流程图/时序图' },
    { id: 'mermaid-mindmap', icon: GitGraph, label: '树状图', prefix: '```mermaid\nmindmap\n  root\n    A\n    B\n', suffix: '\n```', desc: 'Mermaid 脑图' },
    { id: 'ul', icon: List, label: '无序列表', prefix: '- ', suffix: '', desc: '无序列表' },
    { id: 'ol', icon: ListOrdered, label: '有序列表', prefix: '1. ', suffix: '', desc: '有序列表' },
    { id: 'task', icon: CheckSquare, label: '任务列表', prefix: '- [ ] ', suffix: '', desc: '任务列表' },
    { id: 'table', icon: Table, label: '表格', prefix: '| 标题 | 标题 |\n| --- | --- |\n| 内容 | 内容 |', desc: '插入 Markdown 表格' },
    { id: 'hr', icon: Minus, label: '分割线', prefix: '\n---\n', suffix: '', desc: '水平分割线' },
  ];

  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto bg-white/20 dark:bg-slate-800/20 backdrop-blur-md rounded-lg border border-slate-200/40 dark:border-slate-700/40 p-1.5 shadow-sm scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent", className)}>
      {tools.map((tool) => (
        <Tooltip key={tool.id} content={tool.desc || tool.label}>
          <motion.button
            onClick={() => {
              if (tool.isUpload && onImageUpload) {
                  onImageUpload();
              } else {
                  onInsert(tool.prefix, tool.suffix);
              }
            }}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors duration-200 flex-shrink-0"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <tool.icon size={18} strokeWidth={2} />
          </motion.button>
        </Tooltip>
      ))}
    </div>
  );
};
