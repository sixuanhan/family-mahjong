import type { GameState } from './gameState';
import type { Tile } from '../types/tile';

/**
 * 当前玩家摸一张牌
 */
export function drawTile(
  state: GameState,
  playerId: string
): GameState {
  if (state.turnPhase !== 'waiting_draw') {
    throw new Error('当前不能摸牌');
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error('不是当前玩家');
  }

  if (state.wall.length === 0) {
    throw new Error('牌山已空');
  }

  const players = state.players.map(p => ({ ...p }));
  const tile = state.wall[0];

  players[state.currentPlayerIndex].hand.push(tile);

  return {
    ...state,
    wall: state.wall.slice(1),
    players,
    turnPhase: 'waiting_discard',
  };
}
