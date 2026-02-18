// server/index.ts
import { WebSocket, WebSocketServer } from 'ws';
import { createServer } from 'http';
import { createInitialGameState } from '../src/game/initGame.js';
import { discardTile } from '../src/game/discard.js';
import { drawTile } from '../src/game/draw.js';
import { handlePeng } from '../src/game/handlePeng.js';
import { handleChi } from '../src/game/handleChi.js';
import { handleMingGang, handleAnGang, handleJiaGang } from '../src/game/handleGang.js';
import { handleRon, handleZimo } from '../src/game/handleHu.js';
import { handleFlower } from '../src/game/handleFlower.js';
import { passResponse } from '../src/game/passResponse.js';
import { isResponseTimeout, autoPassAll, allResponsesDone, getWinningResponse, endResponsePhase } from '../src/game/resolveResponse.js';
import { initCompetition, rollDice, settleScores, voteNextGame, checkHuangzhuang, handleHuangzhuang, voteRestartGame, voteRestartCompetition } from '../src/game/competition.js';
import type { GameState } from '../src/game/gameState.js';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync, unlinkSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const PORT = parseInt(process.env.PORT || '3000', 10);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');

// MIME types for static file serving
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// HTTP server that serves the built frontend
const httpServer = createServer((req, res) => {
  let filePath = join(DIST_DIR, req.url === '/' ? 'index.html' : req.url!);

  // Security: prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    // If path is a directory or doesn't exist with extension, try index.html (SPA fallback)
    let stat;
    try {
      stat = statSync(filePath);
      if (stat.isDirectory()) {
        filePath = join(filePath, 'index.html');
        stat = statSync(filePath);
      }
    } catch {
      // File not found — SPA fallback to index.html
      filePath = join(DIST_DIR, 'index.html');
      stat = statSync(filePath);
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const data = readFileSync(filePath);

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const wss = new WebSocketServer({ server: httpServer });

const SAVE_FILE = './game-state.json';

// 从文件加载游戏状态
function loadGameState(): GameState | null {
  try {
    if (existsSync(SAVE_FILE)) {
      const data = readFileSync(SAVE_FILE, 'utf-8');
      console.log('[Server] Loaded game state from file');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[Server] Failed to load game state:', err);
  }
  return null;
}

// 保存游戏状态到文件
function saveGameState(state: GameState | null) {
  try {
    if (state) {
      writeFileSync(SAVE_FILE, JSON.stringify(state, null, 2));
    } else if (existsSync(SAVE_FILE)) {
      unlinkSync(SAVE_FILE);
      console.log('[Server] Cleared saved game state');
    }
  } catch (err) {
    console.error('[Server] Failed to save game state:', err);
  }
}

let game: GameState | null = loadGameState();
const clients = new Map<WebSocket, string>();

wss.on('connection', (ws, req) => {
    // 尝试从 URL 参数获取重连 ID
    const url = new URL(req.url || '', 'http://localhost');
    const reconnectId = url.searchParams.get('reconnectId');
    
    let playerId: string;
    let isReconnect = false;
    
    // 检查是否是重连
    if (reconnectId && game) {
        const existingPlayer = game.players.find(p => p.id === reconnectId);
        if (existingPlayer) {
            // 重连：复用旧的 playerId
            playerId = reconnectId;
            isReconnect = true;
            existingPlayer.isOnline = true;
            console.log(`[WS] Player ${playerId} reconnected`);
        } else {
            playerId = randomUUID();
        }
    } else {
        playerId = randomUUID();
    }
    
    // 如果不是重连，检查房间是否已满
    if (!isReconnect && game && game.players.length >= 4) {
        console.log(
          `[WS] Reject connection: room full (${game.players.length}/4)`
        );

        ws.send(
          JSON.stringify({
            type: 'error',
            message: '房间已满（最多 4 人）',
          })
        );

        ws.close();
        return;
    }
    
  clients.set(ws, playerId);

  if (!game) {
    game = {
      roomId: 'room1',
      players: [],
      wall: [],
      currentPlayerIndex: 0,
      turnPhase: '等待摸牌',
      roomPhase: 'waiting_players',
      playerScores: {},
      zhuangIndex: 0,
      gameNumber: 0,
      huangzhuangCount: 0,
    };
  }

  ws.send(
    JSON.stringify({
      type: 'welcome',
      playerId,
      game,
    })
  );
  
  // 如果是重连，广播给其他玩家
  if (isReconnect) {
    broadcast(game);
  }

    ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (!game) return;

    try {
        switch (msg.action) {
        case 'join': {
            if (game.players.find((p) => p.id === playerId)) return;

            game.players.push({
            id: playerId,
            name: msg.name ?? `玩家${game.players.length + 1}`,
            hand: [],
            melds: [],
            discards: [],
            isReady: false,
            isOnline: true,
            });

            console.log(
            `[WS] Player ${playerId} connected, current players: ${game.players.length}`
            );

            if (game.players.length >= 2) {
            game.roomPhase = 'waiting_ready';
            }

            broadcast(game);
            break;
        }

        case 'ready': {
            const player = game.players.find((p) => p.id === playerId);
            if (!player) return;

            player.isReady = true;

            if (msg.name && typeof msg.name === 'string') {
            player.name = msg.name;
            } else if (!player.name) {
            player.name = player.id.slice(0, 6);
            }

            const allReady =
            game.players.length >= 2 &&
            game.players.every((p) => p.isReady);

            if (allReady) {
            // 初始化比赛，进入掷骰子阶段
            game = initCompetition(game);
            }

            if (game) broadcast(game);
            break;
        }

        case 'rollDice': {
            if (game.roomPhase !== 'rolling_dice') return;
            game = rollDice(game, playerId);
            if (game) broadcast(game);
            break;
        }

        case 'nextGame': {
            if (game.roomPhase !== 'settling') return;
            game = voteNextGame(game, playerId);
            if (game) broadcast(game);
            break;
        }

        case 'voteRestartGame': {
            console.log('[Server] voteRestartGame from', playerId, 'roomPhase:', game.roomPhase);
            if (game.roomPhase !== 'playing' && game.roomPhase !== 'settling' && game.roomPhase !== 'rolling_dice') return;
            game = voteRestartGame(game, playerId);
            if (game) broadcast(game);
            break;
        }

        case 'voteRestartCompetition': {
            console.log('[Server] voteRestartCompetition from', playerId, 'roomPhase:', game.roomPhase);
            // 可以在任何阶段重开比赛（除了等待玩家和等待准备）
            if (game.roomPhase === 'waiting_players' || game.roomPhase === 'waiting_ready') return;
            game = voteRestartCompetition(game, playerId);
            if (game) broadcast(game);
            break;
        }

        // ===== 游戏内动作（只在 playing 时允许） =====
        case 'draw':
        case 'discard':
        case 'peng':
        case 'chi':
        case 'gang':
        case 'angang':
        case 'jiagang':
        case 'flower':
        case 'hu':
        case 'zimo':
        case 'pass': {
            if (game.roomPhase !== 'playing') return;

            // Response actions (peng/chi/gang/hu/pass) can race with the
            // 500ms timer that auto-resolves the response phase. If the
            // phase has already moved on, silently ignore the stale click
            // instead of throwing an error popup to the player.
            const isResponseAction = ['peng', 'chi', 'gang', 'hu', 'pass'].includes(msg.action);
            if (isResponseAction && game.turnPhase !== '等待响应') {
              console.log(`[Server] Ignoring stale '${msg.action}' from ${playerId} (phase is now '${game.turnPhase}')`);
              return;
            }

            let newGame = game;
            if (msg.action === 'draw') {
              newGame = drawTile(game, playerId);
            }
            if (msg.action === 'discard') {
              // 检查是否是花牌，如果是则自动补花而不是出牌
              const player = game.players.find(p => p.id === playerId);
              const tile = player?.hand.find((t: { id: string; suit: string }) => t.id === msg.tileId);
              if (tile?.suit === 'flower') {
                newGame = handleFlower(game, playerId, msg.tileId);
              } else {
                newGame = discardTile(game, playerId, msg.tileId);
              }
            }
            if (msg.action === 'peng') {
              newGame = handlePeng(game, playerId);
            }
            if (msg.action === 'chi') {
              newGame = handleChi(game, playerId, msg.tileIds);
            }
            if (msg.action === 'gang') {
              newGame = handleMingGang(game, playerId);
            }
            if (msg.action === 'angang') {
              newGame = handleAnGang(game, playerId, msg.tileId);
            }
            if (msg.action === 'jiagang') {
              newGame = handleJiaGang(game, playerId, msg.tileId);
            }
            if (msg.action === 'flower') {
              newGame = handleFlower(game, playerId, msg.tileId);
            }
            if (msg.action === 'hu') {
              newGame = handleRon(game, playerId);
            }
            if (msg.action === 'zimo') {
              newGame = handleZimo(game, playerId);
            }
            if (msg.action === 'pass') {
              newGame = passResponse(game, playerId);
            }

            game = newGame;
            
            // 检查荒庄（牌山剩余32张且无人胡牌）
            if (game && game.roomPhase === 'playing' && checkHuangzhuang(game)) {
              game = handleHuangzhuang(game);
            }
            
            // 游戏结束时自动结算分数（仅有人胡牌时）
            if (game && game.turnPhase === '游戏结束' && game.winner) {
              game = settleScores(game);
            }
            
            // 自动摸牌：如果当前是"等待摸牌"阶段，自动帮当前玩家摸牌
            if (game && game.turnPhase === '等待摸牌' && game.wall.length > 0) {
              const currentPlayer = game.players[game.currentPlayerIndex];
              game = drawTile(game, currentPlayer.id);
            }
            
            if (game) broadcast(game);
            break;
        }
        }
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: String(err) }));
    }
    });

    ws.on('close', () => {
        const playerId = clients.get(ws);
        clients.delete(ws);
        
        if (playerId && game) {
            // 如果游戏还在等待阶段，直接移除玩家
            if (game.roomPhase === 'waiting_players' || game.roomPhase === 'waiting_ready') {
                game.players = game.players.filter(p => p.id !== playerId);
                console.log(`[WS] Player ${playerId} disconnected and removed, remaining: ${game.players.length}`);
                
                // 如果没有玩家了，重置游戏
                if (game.players.length === 0) {
                    game = null;
                    saveGameState(null); // 清除保存的状态
                    console.log('[WS] No players left, game reset');
                } else {
                    broadcast(game);
                }
            } else {
                // 游戏进行中，标记为离线
                const player = game.players.find(p => p.id === playerId);
                if (player) {
                    player.isOnline = false;
                    console.log(`[WS] Player ${playerId} disconnected (marked offline)`);
                    broadcast(game);
                }
            }
        }
    });

});

function broadcast(gameState: GameState) {
  // 保存状态到文件（用于服务器重启后恢复）
  saveGameState(gameState);
  
  const msg = JSON.stringify({ type: 'sync', game: gameState });
  for (const client of Array.from(clients.keys())) {
    if (client.readyState === 1) { // OPEN
      client.send(msg);
    }
  }
}

console.log(`[Server] Listening on http://0.0.0.0:${PORT}`);
console.log(`[Server] Share this with players: http://<YOUR_IP>:${PORT}`);
httpServer.listen(PORT, '0.0.0.0');

// 定时检查响应超时（每500ms检查一次）
setInterval(() => {
  if (!game || game.roomPhase !== 'playing' || game.turnPhase !== '等待响应') {
    return;
  }

  const pending = game.pendingResponses;
  if (!pending) return;

  // 检查是否所有响应已完成或超时
  if (isResponseTimeout(game) || allResponsesDone(game)) {
    let currentGame: GameState = game;
    
    // 先把所有pending标记为pass
    if (isResponseTimeout(currentGame)) {
      currentGame = autoPassAll(currentGame);
    }
    
    // 检查获胜响应
    const winner = getWinningResponse(currentGame);
    
    if (winner && winner.action === 'chi' && currentGame.pendingResponses?.chiTileIds) {
      // 执行chi
      const chiTileIds = currentGame.pendingResponses.chiTileIds;
      currentGame = handleChi(currentGame, winner.playerId, chiTileIds, true);
    } else if (!winner) {
      // 没有人响应，进入下家摸牌
      currentGame = endResponsePhase(currentGame);
      // 自动摸牌
      if (currentGame.turnPhase === '等待摸牌' && currentGame.wall.length > 0) {
        const nextPlayer = currentGame.players[currentGame.currentPlayerIndex];
        currentGame = drawTile(currentGame, nextPlayer.id);
      }
    }
    // peng/gang/hu 应该已经在响应时立即执行了
    
    // 检查荒庄
    if (currentGame.roomPhase === 'playing' && checkHuangzhuang(currentGame)) {
      console.log('[Server] 荒庄!');
      currentGame = handleHuangzhuang(currentGame);
    }
    
    game = currentGame;
    broadcast(game);
  }
}, 500);

