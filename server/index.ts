// server/index.ts
import { WebSocket, WebSocketServer } from 'ws';
import { createInitialGameState } from '../src/game/initGame.js';
import { discardTile } from '../src/game/discard.js';
import { drawTile } from '../src/game/draw.js';
import { handlePeng } from '../src/game/handlePeng.js';
import { passResponse } from '../src/game/passResponse.js';
import type { GameState } from '../src/game/gameState.js';
import { randomUUID } from 'crypto';

const wss = new WebSocketServer({ port: 8080 });

let game: GameState | null = null;
const clients = new Map<WebSocket, string>();

wss.on('connection', (ws) => {
  const playerId = randomUUID();
  clients.set(ws, playerId);
  console.log(`[WS] Player ${playerId} connected. Total: ${clients.size}`);

  // 首次连接时初始化游戏（仅当有足够玩家时）
  if (!game && clients.size === 1) {
    game = createInitialGameState('room1', [
      { id: 'p1', name: '你', hand: [], melds: [], discards: [], isReady: true, isOnline: true },
      { id: 'p2', name: 'AI', hand: [], melds: [], discards: [], isReady: true, isOnline: true },
    ]);
    console.log('[Server] Game initialized');
  }

  // 初始同步当前游戏状态
  if (game) {
    ws.send(JSON.stringify({ type: 'sync', game }));
  }

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    console.log(`[WS] ${playerId} action:`, msg.action);

    if (!game) return;

    try {
      let newGame = game;

      switch (msg.action) {
        case 'draw':
          newGame = drawTile(game, msg.playerId);
          break;

        case 'discard':
          newGame = discardTile(game, msg.playerId, msg.tileId);
          break;

        case 'peng':
          newGame = handlePeng(game, msg.playerId);
          break;

        case 'pass':
          newGame = passResponse(game, msg.playerId);
          break;

        default:
          console.warn(`[Server] Unknown action: ${msg.action}`);
          return;
      }

      game = newGame;
      broadcast(game);
    } catch (err) {
      console.error(`[Server] Error processing action:`, err);
      ws.send(JSON.stringify({ type: 'error', message: (err as Error).message }));
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Player ${playerId} disconnected. Total: ${clients.size}`);
  });

  ws.on('error', (err) => {
    console.error(`[WS] Error for ${playerId}:`, err);
  });
});

function broadcast(gameState: GameState) {
  const msg = JSON.stringify({ type: 'sync', game: gameState });
  for (const client of Array.from(clients.keys())) {
    if (client.readyState === 1) { // OPEN
      client.send(msg);
    }
  }
}

console.log('[Server] WebSocket server listening on ws://localhost:8080');

