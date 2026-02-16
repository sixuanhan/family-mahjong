import type { GameState } from './gameState';
import { canRon, canZimo, checkHu } from './hu';

/**
 * 处理荣和（别人打出的牌胡牌）
 */
export function handleRon(
  state: GameState,
  playerId: string
): GameState {
  if (state.turnPhase !== '等待响应') {
    throw new Error('当前不能胡牌');
  }

  const pending = state.pendingResponses;
  if (!pending || !pending.huResponders?.includes(playerId)) {
    throw new Error('你不能胡这张牌');
  }

  if (!canRon(state, playerId)) {
    throw new Error('牌型不满足胡牌条件');
  }

  const players = state.players.map(p => ({ ...p }));
  const playerIndex = players.findIndex(p => p.id === playerId);
  const player = players[playerIndex];

  // 将胡的牌加入手牌（展示用）
  const handWithDiscard = [...player.hand, pending.tile];
  player.hand = handWithDiscard;

  // 从打出者的弃牌区移除被胡的牌
  const fromPlayer = players.find(p => p.id === pending.fromPlayerId);
  if (fromPlayer) {
    const discardIdx = fromPlayer.discards.findIndex(t => t.id === pending.tile.id);
    if (discardIdx !== -1) {
      fromPlayer.discards.splice(discardIdx, 1);
    }
  }

  // 计算分数
  const huResult = checkHu(handWithDiscard, player.melds, { isZimo: false });

  return {
    ...state,
    players,
    turnPhase: '游戏结束',
    winner: {
      playerId,
      winType: 'ron',
      winningTile: pending.tile,
      fromPlayerId: pending.fromPlayerId,
      patterns: huResult.patterns,
      totalScore: huResult.totalScore,
    },
    pendingResponses: undefined,
    lastDiscard: undefined,
  };
}

/**
 * 处理自摸
 */
export function handleZimo(
  state: GameState,
  playerId: string
): GameState {
  if (state.turnPhase !== '等待出牌') {
    throw new Error('当前不能自摸');
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error('不是当前玩家');
  }

  if (!canZimo(state, playerId)) {
    throw new Error('牌型不满足胡牌条件');
  }

  const player = state.players.find(p => p.id === playerId)!;

  // 找到最后摸的那张牌（手牌最后一张）
  const winningTile = player.hand[player.hand.length - 1];

  // 计算分数
  const huResult = checkHu(player.hand, player.melds, { isZimo: true });

  return {
    ...state,
    turnPhase: '游戏结束',
    winner: {
      playerId,
      winType: 'zimo',
      winningTile,
      patterns: huResult.patterns,
      totalScore: huResult.totalScore,
    },
  };
}
