# 升级指南

## vNext：Markdown 渲染兼容性修复

本次升级聚焦于 Markdown 扩展语法的兼容性与一致渲染：

- 新增 `==高亮==` 语法渲染为 `<mark>`
- 修复 `$...$ / $$...$$` 数学公式解析与 KaTeX 渲染
- 修复 Mermaid 代码块渲染，并新增 Graphviz（dot/graphviz）代码块渲染
- 增加回归测试集覆盖 CommonMark/GFM/扩展语法

## vNext：文件命名一致性修复

- 修复同步映射中可能出现的 `~xxxxxx` 随机后缀
- 新增“重名自动重命名”规则：同目录同类型重名时按 `文件名 (1).ext`、`文件名 (2).ext` 递增
- 前端在创建/重命名/移动/转换格式后以服务端返回数据为准，确保展示与后端一致

## 行为变化

- 原先“将数学公式写在代码块并标记 language-math”的方式仍可用，但推荐使用标准 `$...$` / `$$...$$`。
- 图表推荐使用显式语言标记：
  - Mermaid：```mermaid
  - Graphviz：```dot 或 ```graphviz

## 依赖变化

- 新增依赖：`@viz-js/viz`（Graphviz 渲染，运行时按需加载）

## 导出一致性说明

当前项目未内置 PDF/Word 导出功能。若你要新增导出：

- 建议复用 [MarkdownPreview.tsx](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/src/components/MarkdownPreview.tsx) 的同一套 “remark 插件 + 组件映射”，以保证桌面端/移动端/导出侧一致渲染。
- Mermaid/Graphviz/KaTeX 的输出均是可嵌入的 SVG/HTML 片段，导出侧应避免再次二次解析 Markdown，改为直接使用渲染后的 HTML。
