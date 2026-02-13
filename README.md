# Family Mahjong 🀄

一款基于 React + TypeScript + Vite 的网页麻将游戏。

## 环境要求

- **Node.js** v20 或更高版本
- **pnpm** 包管理器

## 环境配置

### 1. 安装 Node.js

前往 [https://nodejs.org](https://nodejs.org) 下载并安装 Node.js（推荐 LTS 版本）。

安装完成后，打开终端验证：

```bash
node -v
npm -v
```

### 2. 安装 pnpm

使用 npm 全局安装 pnpm：

```bash
npm install -g pnpm
```

验证安装：

```bash
pnpm -v
```

## 项目启动

### 1. 安装前端依赖

在项目根目录下运行：

```bash
pnpm install
```

### 2. 安装后端依赖

进入 server 目录并安装依赖：

```bash
cd server
pnpm install
```

### 3. 启动开发服务器

需要同时启动前端和后端服务：

**终端 1 - 启动前端（在项目根目录）：**

```bash
pnpm dev
```

前端将运行在 http://localhost:5173/

**终端 2 - 启动后端（在 server 目录）：**

```bash
cd server
pnpm dev
```

后端 WebSocket 服务将运行在 ws://localhost:8080

## 技术栈

- **前端**：React + TypeScript + Vite
- **后端**：Node.js + WebSocket (ws)
- **包管理**：pnpm

## 断线重连与状态恢复

### 客户端断线重连

玩家的 ID 保存在浏览器的 `localStorage` 中，支持以下场景自动重连：

| 场景 | 是否自动重连 | 说明 |
|------|-------------|------|
| 刷新页面 | ✅ | 自动恢复到原来的位置 |
| 关闭标签页后重新打开 | ✅ | 使用相同浏览器即可 |
| 关闭浏览器后重新打开 | ✅ | localStorage 数据持久保存 |
| 换浏览器/设备 | ❌ | 需要重新加入游戏 |

**手动清除身份（重新开始）：**

在浏览器控制台执行：
```javascript
localStorage.removeItem('mahjong-playerId');
location.reload();
```

### 服务器状态持久化

服务器会将游戏状态保存到 `server/game-state.json` 文件，支持服务器重启后恢复：

| 场景 | 状态是否保留 |
|------|-------------|
| 使用 Ctrl+C 停止服务器 | ✅ 保留 |
| 服务器重启 | ✅ 自动加载上次状态 |
| 所有玩家断开（等待阶段） | ❌ 自动清除 |

**手动重置游戏（服务器端）：**

删除状态文件后重启服务器：
```bash
cd server
rm game-state.json   # 或 del game-state.json (Windows)
pnpm dev
```

### 优雅退出

**服务器管理员：**
- 使用 `Ctrl+C` 停止服务器，状态会自动保存
- 玩家可以稍后重连继续游戏

**玩家：**
- 可以随时关闭浏览器，回来后自动重连
- 如果想彻底退出并重新加入，需要清除 localStorage

### 异常情况处理

| 情况 | 系统行为 |
|------|---------|
| 玩家网络中断 | 标记为离线，保留位置和手牌 |
| 玩家在游戏中关闭页面 | 同上，等待重连 |
| 服务器意外崩溃 | 重启后从 game-state.json 恢复 |
| 所有玩家在等待阶段离开 | 游戏重置，删除存档 |
