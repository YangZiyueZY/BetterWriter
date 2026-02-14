# 启动性能优化报告（动态加载/代码拆分）

## 目标

- 降低首屏包体积与解析成本，提升启动速度与交互就绪速度
- 将非首屏/非核心能力按需加载，并提供 Skeleton/错误兜底
- 增加基础性能监控，便于对比优化前后指标

## 核心改动

### 1) 代码拆分与懒加载（按使用场景加载）

- 登录前不再加载编辑器与侧边栏：主界面通过 `React.lazy + Suspense` 按需加载
  - [App.tsx](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/src/App.tsx)
- Markdown 预览渲染链路拆分为独立 chunk：预览需要时才加载 `react-markdown/remark/rehype`
  - [Editor.tsx](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/src/components/Editor.tsx)
  - [MarkdownPreview.tsx](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/src/components/MarkdownPreview.tsx)
- Mermaid 与代码高亮进一步按需加载：
  - Mermaid：运行时动态加载 `mermaid`（只有遇到 ```mermaid 才触发）
    - [Mermaid.tsx](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/src/components/Mermaid.tsx)
  - 代码高亮：运行时动态加载 `react-syntax-highlighter`（只有 fenced code block 才触发）
    - [CodeBlock.tsx](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/src/components/CodeBlock.tsx)
- 设置模块延迟加载，并且内部 tab 进一步分块：
  - 入口懒加载： [Sidebar.tsx](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/src/components/Sidebar.tsx)
  - 内部 tab 懒加载： [SettingsModal.tsx](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/src/components/SettingsModal.tsx)

### 2) 路由级拆分（以现有“页面状态”代替路由）

项目目前无 react-router，页面切换依赖状态条件渲染（登录页/主界面/错误页）。本次把这些“页面级模块”按需拆分，实现等价的“路由级 chunk”效果：

- 登录页：首屏保留
- 主界面（Sidebar/Editor）：登录后才加载
- 预览模块（MarkdownPreview）：进入预览/分屏后才加载

### 3) 预加载策略

- 登录后在空闲时预加载“设置模块 + 预览模块”，减少用户首次打开时的等待
  - [App.tsx](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/src/App.tsx)

### 4) Skeleton / 错误兜底

- Suspense fallback 提供骨架屏
- 动态 import 失败使用错误边界降级并提供重试/刷新
  - [LazyErrorBoundary.tsx](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/src/components/LazyErrorBoundary.tsx)

## 构建层面的拆分策略（Vite/Rollup）

- 增加 `manualChunks`，将 `react-vendor / motion / markdown / katex / syntax / mermaid` 拆到独立 chunk
  - [vite.config.ts](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/vite.config.ts)

## 包体积对比（生产构建输出）

### 基线（优化前）

- 主包：`dist/assets/index-*.js ≈ 1,829.42 kB`（gzip ≈ 572 kB）

### 优化后（本次）

- 主包：`dist/assets/index-*.js ≈ 100.50 kB`（gzip ≈ 35.23 kB）
- 预览/重型依赖拆为按需 chunk：
  - `markdown-*.js ≈ 167.28 kB`
  - `syntax-*.js ≈ 1,696.72 kB`（仅在 fenced code block 需要高亮时加载）
  - `mermaid-*.js ≈ 2,290.68 kB`（仅在 mermaid 图需要时加载）

结论：首屏主包体积下降约 94%+（远超 30% 目标），启动解析/执行压力显著降低。

## 性能监控与指标采集

- 启动时初始化性能监控，并记录 `bootstrap_to_first_render_ms`
  - [perfMonitoring.ts](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/src/lib/perfMonitoring.ts)
  - [main.tsx](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/src/main.tsx)
- 运行时可在浏览器控制台查看：
  - `window.__bw_perf`（包含 marks/measures/paint/LCP）

## Lighthouse

建议在生产预览模式进行审计：

```bash
npm run build
npm run preview
```

然后对 `http://localhost:4173` 运行 Lighthouse，重点观察：

- Performance 总分
- FCP / LCP / TBT（或 INP）与 JS 执行时间
- “Avoid enormous network payloads” 与 “Reduce unused JavaScript”

