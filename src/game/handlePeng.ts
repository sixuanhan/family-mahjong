import type { GameState } from './gameState';
import { isSameTile } from './tileUtils';

export function handlePeng(
  state: GameState,
  playerId: string
): GameState {
  if (state.turnPhase !== '等待响应') {
    throw new Error('当前不能碰');
  }

  const pending = state.pendingResponses;
  if (!pending || !pending.responders.includes(playerId)) {
    throw new Error('你不能碰这张牌');
  }

  const players = state.players.map(p => ({ ...p }));
  const playerIndex = players.findIndex(p => p.id === playerId);
  const player = players[playerIndex];

  // 从手牌移除两张
  const removed = player.hand.filter(
    t => isSameTile(t, state.lastDiscard!.tile)
  ).slice(0, 2);

  if (removed.length < 2) {
    throw new Error('手牌不足，无法碰');
  }

  player.hand = player.hand.filter(
    t => !removed.includes(t)
  );

  // 加入副露
  player.melds.push({
    type: 'peng',
    tiles: [pending.tile, ...removed],
    fromPlayerId: pending.fromPlayerId,
  });

  return {
    ...state,
    players,
    currentPlayerIndex: playerIndex,
    turnPhase: '等待出牌',
    pendingResponses: undefined,
    lastDiscard: undefined,
  };
}
