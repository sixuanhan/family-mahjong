# Family Mahjong 🀄

一款基于 React + TypeScript + Vite 的网页麻将游戏，支持互联网跨国联机。

## 环境要求

- **Node.js** v20 或更高版本
- **pnpm** 包管理器

## 快速开始（本地开发）

### 1. 安装依赖

```bash
pnpm install
cd server && pnpm install && cd ..
```

### 2. 启动开发环境

需要同时启动前端和后端服务：

**终端 1 - 启动后端（在项目根目录）：**

```bash
pnpm dev:server
```

**终端 2 - 启动前端（在项目根目录）：**

```bash
pnpm dev
```

前端将运行在 http://localhost:5173/（Vite 会自动将 WebSocket 代理到后端）

---

## 🌐 互联网联机部署

### 方式一：Cloudflare Tunnel（推荐，免费，最简单）

无需公网 IP、无需域名、无需端口转发，在你自己的电脑上运行即可。

#### 步骤

1. **构建并启动生产服务器：**

```bash
pnpm prod
```

服务器将在 `http://localhost:3000` 启动（前端 + WebSocket 共享同一端口）。

2. **安装 Cloudflare Tunnel 客户端：**

   - **Windows**: 下载 https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi
   - **macOS**: `brew install cloudflared`
   - **Linux**: `curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared && chmod +x cloudflared`

3. **开启隧道：**

```bash
cloudflared tunnel --url http://localhost:3000
```

输出中会显示一个公网地址，如：

```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://random-words-here.trycloudflare.com                                               |
+--------------------------------------------------------------------------------------------+
```

4. **将这个 `https://xxx.trycloudflare.com` 链接发给所有玩家**，在浏览器中打开即可游戏！

> **注意**：每次运行 `cloudflared tunnel` 会分配一个新的随机域名。保持 cloudflared 进程运行期间链接有效。

---

### 方式二：VPS / 云服务器部署

适用于有自己服务器（AWS EC2、DigitalOcean、Hetzner 等）的情况。

```bash
# 在服务器上
git clone <your-repo-url>
cd family-mahjong
pnpm install
cd server && pnpm install && cd ..
pnpm build
PORT=80 pnpm start
```

玩家通过 `http://<服务器IP>` 即可访问。

**使用 pm2 保持运行：**

```bash
npm install -g pm2
pnpm build
cd server
PORT=80 pm2 start --interpreter node --node-args="--import tsx" index.ts --name mahjong
```

---

## 自定义端口

服务器默认使用端口 3000，可通过环境变量修改：

```bash
PORT=8080 pnpm start
```

## 技术栈

- **前端**：React + TypeScript + Vite
- **后端**：Node.js + WebSocket (ws) + HTTP（静态文件服务）
- **包管理**：pnpm

## 网络架构

生产模式下，一个 Node.js 进程同时提供：
- **HTTP 服务**：为前端 SPA 提供静态文件（从 `dist/` 目录）
- **WebSocket 服务**：处理游戏实时通信

共享同一端口，对 Cloudflare Tunnel 等工具和反向代理完全兼容。

## 断线重连

### 自动重连

客户端内置自动重连机制：
- WebSocket 断开后会自动尝试重连（指数退避：1s → 2s → 4s → ... 最长 10s）
- 最多重试 20 次
- 重连期间屏幕顶部显示黄色 "重新连接中..." 提示
- 重连失败后显示红色 "连接已断开" 提示

### 手动重连场景

| 场景 | 是否自动重连 | 说明 |
|------|-------------|------|
| 网络短暂中断 | ✅ | 自动重连，无需操作 |
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

服务器会将游戏状态保存到 `server/game-state.json` 文件，支持服务器重启后恢复。

**手动重置游戏（服务器端）：**

```bash
cd server
rm game-state.json   # 或 del game-state.json (Windows)
pnpm start
```
