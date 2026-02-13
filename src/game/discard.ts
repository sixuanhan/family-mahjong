import type { GameState } from './gameState';
import { canPeng } from './peng';
import { canChi } from './chi';
import { canMingGang } from './gang';
import { canRon } from './hu';

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

  const stateWithDiscard = { ...state, players, lastDiscard: { tile, playerId } };

  // 检查胡（荣和）- 优先级最高
  const huResponders = players
    .filter(p =>
      p.id !== playerId &&
      canRon(stateWithDiscard, p.id)
    )
    .map(p => p.id);

  // 检查碰
  const pengResponders = players
    .filter(p =>
      p.id !== playerId &&
      canPeng(stateWithDiscard, p.id)
    )
    .map(p => p.id);

  // 检查明杠
  const gangResponders = players
    .filter(p =>
      p.id !== playerId &&
      canMingGang(stateWithDiscard, p.id)
    )
    .map(p => p.id);

  // 检查吃（只有下家）
  const nextPlayerIndex = (state.currentPlayerIndex + 1) % players.length;
  const nextPlayer = players[nextPlayerIndex];
  const chiResponder = canChi(stateWithDiscard, nextPlayer.id)
    ? nextPlayer.id
    : undefined;

  // 合并所有响应者
  const allResponders = [
    ...new Set([
      ...huResponders,
      ...pengResponders,
      ...gangResponders,
      ...(chiResponder ? [chiResponder] : [])
    ])
  ];

  const hasResponders = allResponders.length > 0;
  const now = Date.now();
  const minWaitMs = 2000;  // 至少等待2秒让玩家看牌
  const responseTimeoutMs = 15000; // 有响应者时15秒超时

  return {
    ...state,
    players,
    lastDiscard: { tile, playerId },
    turnPhase: '等待响应',  // 总是进入等待响应阶段
    currentPlayerIndex: state.currentPlayerIndex,
    pendingResponses: {
      tile,
      fromPlayerId: playerId,
      responders: pengResponders,
      gangResponders: gangResponders.length > 0 ? gangResponders : undefined,
      chiResponder,
      huResponders: huResponders.length > 0 ? huResponders : undefined,
      responses: hasResponders
        ? Object.fromEntries(allResponders.map(id => [id, 'pending']))
        : {},  // 没有响应者时为空对象
      minWaitUntil: now + minWaitMs,
      responseDeadline: hasResponders ? now + responseTimeoutMs : now + minWaitMs,
    },
  };
}
