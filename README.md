# BetterWriter

BetterWriter 是一个专注于提供舒适写作体验的现代 Markdown 编辑器。它集成了护眼主题、云端同步、移动端互联以及企业级的安全防护功能，旨在为用户打造一个既美观又可靠的写作环境。

## ✨ 核心特性

*   **📝 沉浸式写作体验**：支持 Github Flavored Markdown (GFM)，配合流畅的 UI 交互与动画效果。
*   **👁️ 护眼模式**：内置多种精心调配的护眼配色主题，支持深色/浅色模式切换，减轻长时间写作的视觉疲劳。
*   **☁️ 多端数据同步**：
    *   **本地存储**：默认支持服务器本地文件存储。
    *   **云端扩展**：支持配置 **AWS S3** (及兼容协议) 和 **WebDAV** 进行数据备份与同步。
    *   **移动端互联**：通过专属 `Mobile Key` 快速连接移动端 APP，实现跨设备写作。
*   **🔒 安全可靠**：
    *   **数据加密**：敏感配置（如云存储密钥）在数据库中加密存储。
    *   **安全防护**：内置 SSRF（服务端请求伪造）防护与路径穿越拦截，保障服务器安全。
    *   **身份验证**：基于 JWT 的安全认证机制。

## 🛠️ 技术栈

### 前端 (Web)
*   **框架**: React 19, Vite 6
*   **语言**: TypeScript
*   **样式**: TailwindCSS, Framer Motion (动画)
*   **状态管理**: Zustand
*   **编辑器**: React Markdown, Remark GFM
*   **图标**: Lucide React

### 后端 (Server)
*   **运行环境**: Node.js
*   **框架**: Express
*   **数据库**: SQLite (通过 Sequelize ORM 管理)
*   **安全**: Helmet, CORS, Rate Limit, Bcrypt, JWT

## 🚀 快速开始

### 1. 环境要求
*   Node.js (v18 或更高版本)
*   npm 或 yarn

### 2. 安装依赖

项目包含前端和后端两个部分，需要分别安装依赖。

```bash
# 1. 安装前端依赖
npm install

# 2. 安装后端依赖
cd server
npm install
```

### 3. 环境配置

#### 后端配置 (`server/.env`)
在 `server` 目录下复制 `.env.example` 为 `.env`，并配置必需的密钥：

```bash
cd server
cp .env.example .env
```

编辑 `server/.env` 文件：
*   `JWT_SECRET`: 用于生成用户 Token 的签名密钥（**必须修改**，请使用强随机字符串）。
*   `STORAGE_SECRET`: 用于加密存储配置的密钥（**必须修改**，且设置后不可轻易更改，否则会导致已保存的配置无法解密）。
*   `PORT`: 后端服务端口 (默认为 3001)。
*   `ALLOW_PRIVATE_STORAGE_ENDPOINTS`: 是否允许连接内网 WebDAV/S3 地址 (生产环境建议设为 `false`)。

#### 前端配置 (`.env`)
在项目根目录下复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

*   `VITE_API_BASE_URL`: 后端 API 地址。开发环境下通常为 `http://localhost:3001/api`，生产环境请根据部署域名配置。

### 4. 启动开发服务器

需要同时启动前端和后端服务。建议开启两个终端窗口。

**终端 1 (后端):**
```bash
cd server
npm run dev
```
后端服务将在 `http://localhost:3001` 启动，并自动初始化 SQLite 数据库。

**终端 2 (前端):**
```bash
npm run dev
```
前端服务将在 `http://localhost:5173` 启动。

## 📦 部署构建

### 构建前端
```bash
npm run build
```
构建产物位于 `dist` 目录。

### 构建后端
```bash
cd server
npm run build
```
构建产物位于 `server/dist` 目录。

### 生产环境运行
确保配置了生产环境的 `.env` 变量（特别是 `JWT_SECRET`, `STORAGE_SECRET`, `CORS_ORIGINS`）。

```bash
# 启动后端
cd server
node dist/index.js
```
前端静态资源建议通过 Nginx 或其他 Web 服务器托管，并反向代理 `/api` 请求到后端服务。

## 🛡️ 安全说明

*   **密钥管理**: 请务必保管好 `JWT_SECRET` 和 `STORAGE_SECRET`。
*   **CORS**: 在生产环境中，建议通过环境变量配置 `CORS_ORIGINS`，仅允许受信任的前端域名访问 API。
*   **SSRF**: 默认情况下，后端会拦截针对内网 IP 的存储连接请求。如需在内网环境部署并连接内部存储服务，请设置 `ALLOW_PRIVATE_STORAGE_ENDPOINTS=true`。

## 📂 目录结构

```
BetterWriter/
├── src/                # 前端源代码
│   ├── components/     # React 组件
│   ├── lib/            # 工具函数
│   ├── services/       # API 服务与存储适配器
│   ├── store/          # Zustand 状态管理
│   └── ...
├── server/             # 后端源代码
│   ├── src/
│   │   ├── models/     # Sequelize 模型
│   │   ├── routes/     # API 路由
│   │   ├── services/   # 业务逻辑 (同步, 镜像等)
│   │   ├── middleware/ # 中间件 (鉴权等)
│   │   └── lib/        # 后端工具 (加密, SSRF防护)
│   └── ...
└── ...
```

---
License: ISC
