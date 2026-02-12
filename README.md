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
