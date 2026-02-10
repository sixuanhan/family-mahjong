import type { GameState } from './gameState';
import type { Tile } from '../types/tile';
import { canPeng } from './peng';

/**
 * 当前玩家出一张牌，并切换到下一个玩家
 */
export function discardTile(
  state: GameState,
  playerId: string,
  tileId: string
): GameState {
  if (state.turnPhase !== '等待出牌') {
    throw new Error('必须先摸牌才能出牌');
  }

  const players = state.players.map(p => ({ ...p }));
  const currentPlayer = players[state.currentPlayerIndex];

  if (currentPlayer.id !== playerId) {
    throw new Error('不是当前玩家');
  }

  const tileIndex = currentPlayer.hand.findIndex(t => t.id === tileId);
  if (tileIndex === -1) {
    throw new Error('手牌中没有这张牌');
  }

  const [tile] = currentPlayer.hand.splice(tileIndex, 1);
  currentPlayer.discards.push(tile);

  const responders = players
    .filter(p =>
      p.id !== playerId &&
      canPeng(
        { ...state, players, lastDiscard: { tile, playerId } },
        p.id
      )
    )
    .map(p => p.id);

  return {
    ...state,
    players,
    lastDiscard: { tile, playerId },
    turnPhase: responders.length > 0 ? '等待响应' : '等待摸牌',
    currentPlayerIndex:
      responders.length > 0
        ? state.currentPlayerIndex
        : (state.currentPlayerIndex + 1) % players.length,
    pendingResponses:
      responders.length > 0
        ? {
            tile,
            fromPlayerId: playerId,
            responders,
            responses: Object.fromEntries(
              responders.map(id => [id, 'pending'])
            ),
          }
        : undefined,
  };
}
