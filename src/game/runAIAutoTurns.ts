import { drawTile } from './draw';
import { discardTile } from './discard';
import type { GameState } from './gameState';

export function runAIAutoTurns(state: GameState): GameState {
  let current = state;

  while (true) {
    const player = current.players[current.currentPlayerIndex];

    // 轮到真人，停
    if (player.id === 'p1') break;

    // AI：摸牌
    if (current.turnPhase === '等待摸牌') {
      current = drawTile(current, player.id);
    }

    // AI：立刻打出刚摸到的牌
    if (current.turnPhase === '等待出牌') {
      const lastTile =
        current.players[current.currentPlayerIndex].hand[
          current.players[current.currentPlayerIndex].hand.length - 1
        ];

      current = discardTile(current, player.id, lastTile.id);
    }

    // safety
    if (current.wall.length === 0) break;
  }

  return current;
}
