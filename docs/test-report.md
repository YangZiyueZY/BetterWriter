# 功能测试报告

## 范围

- 管理员：用户管理、批量操作、审计日志
- 开发者模式：前端日志、后端日志、服务器状态轮询
- 密码可视化组件：默认不可见、图标与可见状态一致、快速输入/粘贴/自动填充
- 登录安全：同一 IP 多次失败封禁
- 可用性：后端不可达时前端错误页提示与重试
- 账号安全：登录设备管理（列表/筛选/分页/删除/撤销/异常标识）
- 体验优化：自动同步/轮询不触发全屏 Loading
- 云同步：S3/WebDAV 实时同步、中文命名、目录结构一致性、失败重试与全量校验
- 文件管理：创建/重命名命名一致性与重名规则

## 自动化测试

### 前端单元测试

- 框架：Vitest + Testing Library（jsdom）
- 用例文件：[passwordInput.test.tsx](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/src/tests/passwordInput.test.tsx)
- 用例文件：[markdownPreview.test.tsx](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/src/tests/markdownPreview.test.tsx)
- 用例文件：[mermaidErrorHandling.test.tsx](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/src/tests/mermaidErrorHandling.test.tsx)
- 用例文件：[namingFlow.test.ts](file:///e:/%E7%A8%8B%E5%BA%8F/Trea/BetterWriter/src/tests/namingFlow.test.ts)
- 覆盖场景：
  - 默认不可见 + 输入后按钮出现且文案正确
  - 快速输入/粘贴长密码不产生重复渲染（按钮唯一）
  - 切换可见后持续输入保持可见
  - 模拟自动填充后仍可切换
  - CommonMark：粗体/斜体
  - GFM：表格/任务列表
  - 扩展语法：==高亮==、$行内数学$、$$块级数学$$、Mermaid、Graphviz
  - Mermaid：语法错误静默处理，不显示底层错误串
  - 文件命名：创建后合并服务端返回名（重名采用 “ (n)”）
- 结果：通过（`npm test`）

### 后端安全自检

- SSRF/路径穿越回归：`server/src/tests/security.ts`
- 管理员权限中间件：`server/src/tests/adminSecurity.ts`
- 登录失败封禁逻辑：`server/src/tests/loginBan.ts`
- 设备会话鉴权：`server/src/tests/deviceAuth.ts`
- 设备删除/撤销并发一致性：`server/src/tests/deviceConcurrency.ts`
- 结果：通过（`npm --prefix server test`）

## 手工测试用例与结果

### 管理员用户管理

1. admin 登录 → 设置页出现“管理/开发者模式”标签页：通过
2. 用户列表加载/筛选/搜索/刷新：通过
3. 单用户重置密码（二次确认 + 生成密码显示一次 + 可复制）：通过
4. 单用户删除（二次确认 + 清理 files/storage_configs/uploads + 云端清理 best-effort）：通过
5. 批量选择/全选、批量启用/禁用、批量删除：通过
6. 审计日志记录与展示：通过

### 开发者模式

1. 前端 console 捕获与展示、过滤、导出：通过
2. 前端日志时间范围筛选：通过
3. 服务器状态轮询（5s）与手动刷新（CPU%/磁盘/网络IO/进程列表）：通过
4. 后端日志按级别/模块/关键字/时间范围筛选、异常堆栈高亮、导出：通过
5. 日志自动清理（保留 7 天）：通过（启动时清理 + 定时清理）
6. 轮询刷新不触发全屏 Loading（仅模块内局部 loading）：通过

### 自动同步与全局 Loading

1. 编辑任意文档持续输入触发自动保存/同步：通过（不出现全屏 Loading，顶部保存状态正常更新）

### Markdown 预览（数学/图表）

1. 行内数学 `$a+b$` 与块级数学 `$$a+b$$`：通过（实时预览，输入过程中不闪烁）
2. Mermaid（flowchart/mindmap/timeline 等）渲染：通过（去抖渲染，预览不出现周期性刷新/黑框）
3. Mermaid 语法错误：通过（不显示 “Syntax error in text … mermaid version …” 原始错误串）

### 云同步（S3/WebDAV）

1. 开启 S3/WebDAV 后保存/移动/重命名/删除文件与文件夹：通过（云端路径按目录层级同步）
2. 创建中文/Emoji/日文/韩文命名的文件与文件夹：通过（云端与本地镜像保持原始命名，不再转换为 UUID）
3. 在服务器本地镜像目录直接修改/删除 `.md/.txt` 文件：通过（≤5 秒触发同步推送；失败会 30 秒间隔最多重试 3 次）
4. 全量校验：开启云存储后后台每 20 秒触发一次全量同步校验：通过
5. 同步日志：生成 `server/logs/cloud-sync.jsonl`，记录操作类型、路径、时间戳、hash：通过
6. 冲突策略：本地镜像检测到“近期服务器写入 + 本地又修改”时保留冲突副本：通过（新增 `-冲突-本地-<timestamp>` 文件）
7. 手动强制同步接口：`POST /api/storage/sync-item` 传入 `id` 可立即同步指定文件/文件夹：通过

### 文件命名一致性

1. 新建文件输入 `测试.md`：通过（创建后前端/接口/本地镜像/云端均为 `测试.md`，不出现 `~xxxxxx` 后缀）
2. 同目录重名创建 `测试.md`：通过（自动变更为 `测试 (1).md`，规则可读且文档已说明）

### 密码可视化

1. 登录页默认不可见，EyeOff 表示当前隐藏：通过
2. 修改密码页 3 个输入框默认不可见：通过
3. 快速输入/粘贴长密码：通过
4. 切换可见后继续输入：通过
5. 浏览器自动填充（Chrome/Edge）验证：通过

## 性能指标（基线）

- 前端日志：最多保留 2000 条；过滤/渲染在 500 条以内无明显卡顿
- 后端日志：默认拉取最近 6 小时，最多返回 500 条；导出为 JSON 文本

## 跨浏览器兼容性

- Chrome：通过
- Edge：通过
- Firefox：建议验证（主要关注 clipboard 权限策略）
- Safari：建议验证（主要关注 clipboard 与 input type 切换行为）

## 安全扫描与加固

- 前端依赖：`npm audit` 无漏洞（通过 overrides 锁定修复版本）
- 后端依赖：`npm audit` 无漏洞（通过 overrides 锁定 tar 修复版本）
- 权限越权：管理员接口统一加 `authenticateToken` + `requireAdmin`
- SQL 注入：使用 Sequelize 查询/更新，未拼接原生 SQL 条件
- XSS：日志/用户名等在 React 默认转义渲染；未引入 `dangerouslySetInnerHTML`
