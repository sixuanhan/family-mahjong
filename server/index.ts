// server/index.ts
import { WebSocket, WebSocketServer } from 'ws';
import { createInitialGameState } from '../src/game/initGame.js';
import { discardTile } from '../src/game/discard.js';
import { drawTile } from '../src/game/draw.js';
import { handlePeng } from '../src/game/handlePeng.js';
import { passResponse } from '../src/game/passResponse.js';
import type { GameState } from '../src/game/gameState.js';
import { randomUUID } from 'crypto';

const wss = new WebSocketServer({ host: '0.0.0.0', port: 8080 });

let game: GameState | null = null;
const clients = new Map<WebSocket, string>();

wss.on('connection', (ws) => {
    if (game && game.players.length >= 4) {
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

  const playerId = randomUUID();
  clients.set(ws, playerId);

  if (!game) {
    game = {
      roomId: 'room1',
      players: [],
      wall: [],
      currentPlayerIndex: 0,
      turnPhase: '等待摸牌',
      roomPhase: 'waiting_players',
    };
  }

  ws.send(
    JSON.stringify({
      type: 'welcome',
      playerId,
      game,
    })
  );

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
            game = createInitialGameState(
                game.roomId,
                game.players.map((p) => ({
                ...p,
                hand: [],
                melds: [],
                discards: [],
                isReady: true,
                }))
            );
            }

            broadcast(game);
            break;
        }

        // ===== 游戏内动作（只在 playing 时允许） =====
        case 'draw':
        case 'discard':
        case 'peng':
        case 'pass': {
            if (game.roomPhase !== 'playing') return;

            let newGame = game;
            if (msg.action === 'draw') {
            newGame = drawTile(game, playerId);
            }
            if (msg.action === 'discard') {
            newGame = discardTile(game, playerId, msg.tileId);
            }
            if (msg.action === 'peng') {
            newGame = handlePeng(game, playerId);
            }
            if (msg.action === 'pass') {
            newGame = passResponse(game, playerId);
            }

            game = newGame;
            broadcast(game);
            break;
        }
        }
    } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: String(err) }));
    }
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

