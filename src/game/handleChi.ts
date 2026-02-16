import type { GameState } from './gameState';
import { getChiOptions } from './chi';
import { isChiLocked } from './resolveResponse';

/**
 * 处理吃牌操作
 * 吃的优先级最低，需要等待其他玩家确认不碰/杠/胡
 * @param tileIds 手牌中用于吃的两张牌的ID
 * @param executeNow 是否立即执行（用于服务器解析时）
 */
export function handleChi(
  state: GameState,
  playerId: string,
  tileIds: [string, string],
  executeNow: boolean = false
): GameState {
  if (state.turnPhase !== '等待响应') {
    throw new Error('当前不能吃');
  }

  const pending = state.pendingResponses;
  if (!pending || !pending.chiResponder || pending.chiResponder !== playerId) {
    throw new Error('你不能吃这张牌');
  }

  // 检查chi是否被锁定（有人选了peng/gang/hu）
  if (isChiLocked(state) && !executeNow) {
    throw new Error('已有玩家选择了更高优先级的动作');
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

  // 如果不是立即执行，只记录响应和选择的牌
  if (!executeNow) {
    // 检查是否还有其他人可以碰/杠/胡
    const otherCanPengGangHu = 
      (pending.responders.length > 0 && pending.responders.some(id => pending.responses[id] === 'pending')) ||
      (pending.gangResponders && pending.gangResponders.some(id => pending.responses[id] === 'pending')) ||
      (pending.huResponders && pending.huResponders.some(id => pending.responses[id] === 'pending'));

    if (otherCanPengGangHu) {
      // 记录chi选择，等待其他人响应
      return {
        ...state,
        pendingResponses: {
          ...pending,
          responses: {
            ...pending.responses,
            [playerId]: 'chi',
          },
          chiTileIds: tileIds,  // 保存选择的牌ID
        },
      };
    }
  }

  // 立即执行吃牌
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

  // 从打出者的弃牌区移除被吃的牌
  const fromPlayer = players.find(p => p.id === pending.fromPlayerId);
  if (fromPlayer) {
    const discardIdx = fromPlayer.discards.findIndex(t => t.id === pending.tile.id);
    if (discardIdx !== -1) {
      fromPlayer.discards.splice(discardIdx, 1);
    }
  }

  return {
    ...state,
    players,
    currentPlayerIndex: playerIndex,
    turnPhase: '等待出牌',
    pendingResponses: undefined,
    lastDiscard: undefined,
  };
}
