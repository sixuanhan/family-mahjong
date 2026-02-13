import type { GameState } from './gameState';

/**
 * 当前玩家摸一张牌
 */
export function drawTile(
  state: GameState,
  playerId: string
): GameState {
  if (state.turnPhase !== '等待摸牌') {
    throw new Error('当前不能摸牌');
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error('不是当前玩家');
  }

  if (state.wall.length === 0) {
    throw new Error('牌山已空');
  }

  const players = state.players.map(p => ({ 
    ...p, 
    hand: [...p.hand],
  }));
  const wall = [...state.wall];
  const tile = wall.shift()!;

  players[state.currentPlayerIndex].hand.push(tile);

  return {
    ...state,
    wall,
    players,
    turnPhase: '等待出牌',
    lastDrawnTileId: tile.id,
  };
}
