import type { GameState } from './gameState';
import { getChiOptions } from './chi';

/**
 * 处理吃牌操作
 * @param tileIds 手牌中用于吃的两张牌的ID
 */
export function handleChi(
  state: GameState,
  playerId: string,
  tileIds: [string, string]
): GameState {
  if (state.turnPhase !== '等待响应') {
    throw new Error('当前不能吃');
  }

  const pending = state.pendingResponses;
  if (!pending || !pending.chiResponder || pending.chiResponder !== playerId) {
    throw new Error('你不能吃这张牌');
  }

  const players = state.players.map(p => ({ ...p }));
  const playerIndex = players.findIndex(p => p.id === playerId);
  const player = players[playerIndex];

  // 验证选择的牌
  const tile1 = player.hand.find(t => t.id === tileIds[0]);
  const tile2 = player.hand.find(t => t.id === tileIds[1]);

  if (!tile1 || !tile2) {
    throw new Error('选择的牌不在手牌中');
  }

  // 验证这两张牌可以和弃牌组成顺子
  const options = getChiOptions(player.hand, pending.tile);
  const isValidOption = options.some(
    opt =>
      (opt.tiles[0].id === tile1.id && opt.tiles[1].id === tile2.id) ||
      (opt.tiles[0].id === tile2.id && opt.tiles[1].id === tile1.id)
  );

  if (!isValidOption) {
    throw new Error('这两张牌不能和弃牌组成顺子');
  }

  // 从手牌移除两张
  player.hand = player.hand.filter(
    t => t.id !== tile1.id && t.id !== tile2.id
  );

  // 组成顺子（按数值排序）
  const meldTiles = [pending.tile, tile1, tile2].sort((a, b) => {
    const aVal = typeof a.value === 'number' ? a.value : 0;
    const bVal = typeof b.value === 'number' ? b.value : 0;
    return aVal - bVal;
  });

  // 加入副露
  player.melds.push({
    type: 'chi',
    tiles: meldTiles,
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
