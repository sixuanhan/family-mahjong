# Family Mahjong 🀄

一款基于 React + TypeScript + Vite 的网页麻将游戏，支持互联网跨国联机。

## 环境要求

- **Node.js** v20 或更高版本
- **pnpm** 包管理器
- **Cloudflare 账号**（免费）

---

## 本地开发

### 1. 安装依赖

```bash
pnpm install
cd server && pnpm install && cd ..
pnpm add -D vitest
```

### 2. 启动开发环境

需要启动前端和后端两个服务：

**终端 1 - 启动后端服务器：**

```bash
cd server && pnpm dev
```

服务器将运行在 `http://localhost:3000`

**终端 2 - 启动前端开发服务器：**

```bash
pnpm dev
```

前端将运行在 `http://localhost:5173/`，WebSocket 会自动代理到后端。

在浏览器中打开 `http://localhost:5173` 即可游戏。

---

## 🌐 互联网联机部署（国际访问）

要让身在海外（如中国）的朋友通过网络加入游戏，按以下步骤：


### 第一步：启动后端和隧道

**终端 1** 中启动后端服务器：

```bash
cd server && pnpm dev
```

### 第二步：编译生产版本

**终端 2** 中：

```bash
cloudflared tunnel --url http://localhost:3000
```

应该可以看到类似
```
2026-02-16T23:43:07Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
2026-02-16T23:43:07Z INF |  https://isbn-document-photograph-controversy.trycloudflare.com                            |
2026-02-16T23:43:07Z INF +--------------------------------------------------------------------------------------------+
```

在`src/hooks/useGameConnection.ts`中替换网址。

在项目根目录，**终端 3** 中执行：

```bash
pnpm build
```

这会生成 `dist/` 文件夹。


**终端 3** 中开启公网隧道：

```bash
wrangler pages deploy dist --project-name=mahjong
```

等待部署完成，你会看到链接：
```
✨ Deployment complete! Take a peek over at https://xxx-xxx.mahjong-xxx.pages.dev
```

### 第三步：分享链接给朋友

将上面获得的 `https://xxx.pages.dev` 链接发给朋友，他们在浏览器中打开即可加入游戏。

---

## 🧪 测试

运行所有测试：

```bash
pnpm test
```

监听模式（文件变更时自动重跑）：

```bash
pnpm test:watch
```

---

## 💾 游戏状态持久化

后端会自动将游戏状态保存到 `server/game-state.json`，支持服务器重启后恢复进度。

**手动重置游戏：**

```bash
cd server
rm game-state.json
pnpm dev
```

---

## 📋 项目结构

```
src/
  ├── App.tsx              # 主应用组件（WebSocket 连接）
  ├── game/                # 游戏逻辑
  │   ├── gameState.ts     # 游戏状态定义
  │   ├── initGame.ts      # 初始化游戏
  │   ├── discard.ts       # 出牌逻辑
  │   └── ...
  └── types/               # TypeScript 类型定义
server/
  └── index.ts             # WebSocket 服务器
```

---

## 🔧 技术栈

- **前端**：React 19 + TypeScript + Vite
- **后端**：Node.js + WebSocket (ws) + HTTP
- **部署**：Cloudflare Pages + Cloudflare Tunnel
- **包管理**：pnpm
