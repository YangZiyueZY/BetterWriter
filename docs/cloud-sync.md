# 云同步（S3/WebDAV）

## 目标

- 云端目录结构与 BetterWriter 内部文件夹结构一致（保留层级与命名）
- 支持中文/Emoji/日文/韩文等 UTF-8 命名（避免被转换为 UUID）
- 本地镜像文件发生变更时可在 5 秒内推送到云端，并支持失败重试
- 同步日志可追踪每次操作的路径、时间戳与内容哈希

## 存储结构

- 云端 Notes 根目录：`{userId}/notes/`
- 文件路径：按应用内 folder 树展开后的相对路径（文件名保留原始命名，非法字符会被替换为 `_`）
- 空文件夹：通过写入 `.keep` 文件保留（S3/WebDAV）
- 重名规则：同目录下重名时自动追加 ` (n)`（例如 `测试 (1).md`），不会使用随机后缀

## 触发机制

- 实时触发：保存/删除文件与文件夹时立即同步到云端
- 本地镜像监听：服务器镜像目录内的 `.md/.txt` 被外部修改/删除会自动同步（最多重试 3 次，间隔 30 秒）
- 全量校验：开启 S3/WebDAV 后，每 20 秒执行一次全量同步校验（补齐缺失项，并清理已不存在的旧路径）

## 手动强制同步

`POST /api/storage/sync-item`

```json
{ "id": "fileOrFolderId" }
```

返回：

```json
{ "ok": true, "queued": 12 }
```

## 同步日志

日志文件：`server/logs/cloud-sync.jsonl`（JSON Lines）

字段示例：

```json
{"ts":1771060000000,"userId":1,"action":"upsert_file","relPath":"文件夹/笔记.md","remoteKey":"1/notes/文件夹/笔记.md","ok":true,"hash":"..."}
```
