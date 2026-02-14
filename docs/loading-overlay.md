# 页面加载动画（全局 Loading）

项目内置全局全屏加载动画，用于在页面初始化与网络请求期间提供清晰的视觉反馈。

## 行为说明

- 页面首次进入：启动时会请求 `GET /api/health`，期间显示 Loading，结束后自动隐藏。
- 网络请求：所有通过 `src/services/api.ts` 发起的请求都会自动显示/隐藏 Loading（带防闪烁的延迟显示与最短展示时间）。
- 慢网提示：Loading 持续超过 3 秒会显示“加载时间较长”提示（可配置）。

## 组件

- 组件文件：`src/components/GlobalLoadingOverlay.tsx`
- 状态管理：`src/lib/loadingManager.ts`
- 进度条动画：`src/index.css` 的 `bw-loading-bar` keyframes（使用 transform，避免重排）

## 配置

可以在任意初始化代码中调用：

```ts
import { configureLoading } from './lib/loadingManager';

configureLoading({
  title: '正在加载…',
  slowHintText: '加载时间较长，请稍候…',
  delayShowMs: 120,
  minShowMs: 250,
  slowHintMs: 3000,
  blockInteraction: true,
  theme: {
    accentColor: '#3b82f6',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
});
```

## 手动控制

```ts
import { startLoading, stopLoading } from './lib/loadingManager';

const token = startLoading({ title: '正在同步…' });
try {
  await doSomething();
} finally {
  stopLoading(token);
}
```

## 跳过某个请求的 Loading

当某些请求不需要展示 Loading 时：

```ts
await api.get('/xxx', { __bwSkipLoading: true } as any);
```

