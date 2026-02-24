// server/index.ts
import { WebSocket, WebSocketServer } from 'ws';
import { createServer } from 'http';
import { createInitialGameState } from '../src/game/initGame.js';
import { discardTile } from '../src/game/discard.js';
import { drawTile } from '../src/game/draw.js';
import { handleAnGang, handleJiaGang } from '../src/game/handleGang.js';
import { handleZimo } from '../src/game/handleHu.js';
import { handleFlower } from '../src/game/handleFlower.js';
import { isResponseTimeout, autoPassAll, allResponsesDone, resolveResponses, submitResponse } from '../src/game/resolveResponse.js';
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

// Restore mode: if a meaningful saved game exists, offer restore instead of loading directly
interface RestoreInfo {
  savedGame: GameState;
  claims: Record<string, string>; // newPlayerId -> oldPlayerId
  started: boolean;
}

let restoreInfo: RestoreInfo | null = null;
const savedGame = loadGameState();
let game: GameState | null = null;

if (savedGame && savedGame.players.length > 0 &&
    savedGame.roomPhase !== 'waiting_players' && savedGame.roomPhase !== 'waiting_ready') {
  restoreInfo = {
    savedGame,
    claims: {},
    started: false,
  };
  console.log('[Server] Found saved game state with', savedGame.players.length, 'players, restore available');
} else {
  game = savedGame;
}

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

  if (!game && !restoreInfo) {
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
      ...(restoreInfo ? {
        restoreAvailable: {
          players: restoreInfo.savedGame.players.map(p => ({ id: p.id, name: p.name })),
          claims: restoreInfo.claims,
          started: restoreInfo.started,
        }
      } : {}),
    })
  );
  
  // 如果是重连，广播给其他玩家
  if (isReconnect) {
    broadcast(game);
  }

    ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());

    // Handle restore actions (work even when game is null)
    if (msg.action === 'startRestore') {
      if (!restoreInfo) return;
      restoreInfo.started = true;
      broadcastRestoreState();
      return;
    }

    if (msg.action === 'claimPlayer') {
      if (!restoreInfo || !restoreInfo.started) return;
      const oldPlayerId = msg.oldPlayerId as string;
      if (!restoreInfo.savedGame.players.find(p => p.id === oldPlayerId)) return;
      // Check if already claimed by someone else
      const claimedByOther = Object.entries(restoreInfo.claims).find(
        ([newId, oldId]) => oldId === oldPlayerId && newId !== playerId
      );
      if (claimedByOther) return;
      // Set/update claim
      restoreInfo.claims[playerId] = oldPlayerId;
      // Check if all players claimed
      if (Object.keys(restoreInfo.claims).length === restoreInfo.savedGame.players.length) {
        finalizeRestore();
      } else {
        broadcastRestoreState();
      }
      return;
    }

    if (msg.action === 'cancelRestore') {
      if (!restoreInfo) return;
      restoreInfo = null;
      saveGameState(null);
      // Create fresh game
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
      const cancelMsg = JSON.stringify({ type: 'restoreCancelled', game });
      for (const client of Array.from(clients.keys())) {
        if (client.readyState === 1) client.send(cancelMsg);
      }
      return;
    }

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
              newGame = submitResponse(game, playerId, 'peng');
            }
            if (msg.action === 'chi') {
              newGame = submitResponse(game, playerId, 'chi', msg.tileIds);
            }
            if (msg.action === 'gang') {
              newGame = submitResponse(game, playerId, 'gang');
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
              newGame = submitResponse(game, playerId, 'hu');
            }
            if (msg.action === 'zimo') {
              newGame = handleZimo(game, playerId);
            }
            if (msg.action === 'pass') {
              newGame = submitResponse(game, playerId, 'pass');
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
        const pid = clients.get(ws);
        clients.delete(ws);
        
        // Clean up restore claims
        if (pid && restoreInfo && restoreInfo.claims[pid]) {
            delete restoreInfo.claims[pid];
            broadcastRestoreState();
        }
        
        if (pid && game) {
            // 如果游戏还在等待阶段，直接移除玩家
            if (game.roomPhase === 'waiting_players' || game.roomPhase === 'waiting_ready') {
                game.players = game.players.filter(p => p.id !== pid);
                console.log(`[WS] Player ${pid} disconnected and removed, remaining: ${game.players.length}`);
                
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
                const player = game.players.find(p => p.id === pid);
                if (player) {
                    player.isOnline = false;
                    console.log(`[WS] Player ${pid} disconnected (marked offline)`);
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

function broadcastRestoreState() {
  if (!restoreInfo) return;
  const msg = JSON.stringify({
    type: 'restoreUpdate',
    players: restoreInfo.savedGame.players.map(p => ({ id: p.id, name: p.name })),
    claims: restoreInfo.claims,
    started: restoreInfo.started,
  });
  for (const client of Array.from(clients.keys())) {
    if (client.readyState === 1) client.send(msg);
  }
}

function finalizeRestore() {
  if (!restoreInfo) return;
  const oldGame = restoreInfo.savedGame;
  // Build reverse map: oldPlayerId -> newPlayerId
  const reverseMap: Record<string, string> = {};
  for (const [newId, oldId] of Object.entries(restoreInfo.claims)) {
    reverseMap[oldId] = newId;
  }
  game = remapGameState(oldGame, reverseMap);
  game.players.forEach(p => { p.isOnline = true; });
  restoreInfo = null;
  broadcast(game);
}

function remapGameState(oldGame: GameState, idMap: Record<string, string>): GameState {
  const mapId = (id: string) => idMap[id] || id;
  const g = JSON.parse(JSON.stringify(oldGame)) as GameState;

  // Remap player IDs and their meld references
  for (const player of g.players) {
    player.id = mapId(player.id);
    for (const meld of player.melds) {
      if (meld.fromPlayerId) meld.fromPlayerId = mapId(meld.fromPlayerId);
    }
  }

  // Remap scores
  const newScores: Record<string, number> = {};
  for (const [oldId, score] of Object.entries(g.playerScores)) {
    newScores[mapId(oldId)] = score;
  }
  g.playerScores = newScores;

  // Remap other references
  if (g.lastDiscard) g.lastDiscard.playerId = mapId(g.lastDiscard.playerId);

  if (g.pendingResponses) {
    const pr = g.pendingResponses;
    pr.fromPlayerId = mapId(pr.fromPlayerId);
    pr.responders = pr.responders.map(mapId);
    if (pr.gangResponders) pr.gangResponders = pr.gangResponders.map(mapId);
    if (pr.chiResponder) pr.chiResponder = mapId(pr.chiResponder);
    if (pr.huResponders) pr.huResponders = pr.huResponders.map(mapId);
    const newResp: typeof pr.responses = {};
    for (const [oldId, resp] of Object.entries(pr.responses)) {
      newResp[mapId(oldId)] = resp;
    }
    pr.responses = newResp;
  }

  if (g.winner) {
    g.winner.playerId = mapId(g.winner.playerId);
    if (g.winner.fromPlayerId) g.winner.fromPlayerId = mapId(g.winner.fromPlayerId);
  }

  if (g.diceRolls) g.diceRolls = g.diceRolls.map(r => ({ ...r, playerId: mapId(r.playerId) }));
  if (g.diceRollEligible) g.diceRollEligible = g.diceRollEligible.map(mapId);
  if (g.scoreChanges) g.scoreChanges = g.scoreChanges.map(sc => ({ ...sc, playerId: mapId(sc.playerId) }));
  if (g.competitionWinner) g.competitionWinner = mapId(g.competitionWinner);
  if (g.restartGameVotes) g.restartGameVotes = g.restartGameVotes.map(mapId);
  if (g.restartCompetitionVotes) g.restartCompetitionVotes = g.restartCompetitionVotes.map(mapId);
  if (g.nextGameVotes) g.nextGameVotes = g.nextGameVotes.map(mapId);

  return g;
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
    
    // 统一解析响应结果（按优先级：胡 > 碰/杠 > 吃）
    currentGame = resolveResponses(currentGame);

    // 自动摸牌：如果当前是"等待摸牌"阶段，自动帮当前玩家摸牌
    if (currentGame.turnPhase === '等待摸牌' && currentGame.wall.length > 0) {
      const nextPlayer = currentGame.players[currentGame.currentPlayerIndex];
      currentGame = drawTile(currentGame, nextPlayer.id);
    }
    
    // 检查荒庄
    if (currentGame.roomPhase === 'playing' && checkHuangzhuang(currentGame)) {
      console.log('[Server] 荒庄!');
      currentGame = handleHuangzhuang(currentGame);
    }
    
    game = currentGame;
    broadcast(game);
  }
}, 500);

