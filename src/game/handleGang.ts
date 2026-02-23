import type { GameState } from './gameState';
import { isSameTile } from './tileUtils';
import { canMingGang } from './gang';

/**
 * 处理明杠（别人打出的牌）
 */
export function handleMingGang(
  state: GameState,
  playerId: string
): GameState {
  if (state.turnPhase !== '等待响应') {
    throw new Error('当前不能杠');
  }

  const pending = state.pendingResponses;
  if (!pending || !pending.gangResponders?.includes(playerId)) {
    throw new Error('你不能杠这张牌');
  }

  if (!canMingGang(state, playerId)) {
    throw new Error('你没有3张相同的牌');
  }

  const players = state.players.map(p => ({ ...p }));
  const playerIndex = players.findIndex(p => p.id === playerId);
  const player = players[playerIndex];

  // 从手牌移除3张
  const removed = player.hand
    .filter(t => isSameTile(t, pending.tile))
    .slice(0, 3);

  if (removed.length < 3) {
    throw new Error('手牌不足，无法杠');
  }

  player.hand = player.hand.filter(t => !removed.includes(t));

  // 加入副露
  player.melds.push({
    type: 'gang',
    tiles: [pending.tile, ...removed],
    fromPlayerId: pending.fromPlayerId,
  });

  // 从打出者的弃牌区移除被杠的牌
  const fromPlayer = players.find(p => p.id === pending.fromPlayerId);
  if (fromPlayer) {
    const discardIdx = fromPlayer.discards.findIndex(t => t.id === pending.tile.id);
    if (discardIdx !== -1) {
      fromPlayer.discards.splice(discardIdx, 1);
    }
  }

  // 杠完需要从牌山补一张牌
  const wall = [...state.wall];
  if (wall.length === 0) {
    throw new Error('牌山已空');
  }
  const drawnTile = wall.pop()!;
  player.hand.push(drawnTile);

  return {
    ...state,
    players,
    wall,
    currentPlayerIndex: playerIndex,
    turnPhase: '等待出牌',
    pendingResponses: undefined,
    lastDiscard: undefined,
    lastDrawnTileId: drawnTile.id,
    lastAction: { type: 'gang', playerId, actionId: `gang-${Date.now()}` },
  };
}

/**
 * 处理暗杠（手牌中4张相同的）
 * @param tileId 要杠的牌的ID（4张中的任意一张）
 */
export function handleAnGang(
  state: GameState,
  playerId: string,
  tileId: string
): GameState {
  if (state.turnPhase !== '等待出牌') {
    throw new Error('只能在出牌阶段暗杠');
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error('不是当前玩家');
  }

  const players = state.players.map(p => ({ ...p }));
  const player = players[state.currentPlayerIndex];

  // 找到要杠的牌
  const targetTile = player.hand.find(t => t.id === tileId);
  if (!targetTile) {
    throw new Error('手牌中没有这张牌');
  }

  // 检查是否有4张
  const sameTiles = player.hand.filter(t => isSameTile(t, targetTile));
  if (sameTiles.length < 4) {
    throw new Error('需要4张相同的牌才能暗杠');
  }

  // 移除4张牌
  const removed = sameTiles.slice(0, 4);
  player.hand = player.hand.filter(t => !removed.includes(t));

  // 加入副露（暗杠没有fromPlayerId）
  player.melds.push({
    type: 'gang',
    tiles: removed,
  });

  // 从牌山补一张
  const wall = [...state.wall];
  if (wall.length === 0) {
    throw new Error('牌山已空');
  }
  const drawnTile = wall.pop()!;
  player.hand.push(drawnTile);

  return {
    ...state,
    players,
    wall,
    turnPhase: '等待出牌',
    lastDrawnTileId: drawnTile.id,
    lastAction: { type: 'angang', playerId, actionId: `angang-${Date.now()}` },
  };
}

/**
 * 处理加杠（已碰过，又摸到第4张）
 * @param tileId 要加杠的牌的ID
 */
export function handleJiaGang(
  state: GameState,
  playerId: string,
  tileId: string
): GameState {
  if (state.turnPhase !== '等待出牌') {
    throw new Error('只能在出牌阶段加杠');
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error('不是当前玩家');
  }

  const players = state.players.map(p => ({ ...p }));
  const player = players[state.currentPlayerIndex];

  // 找到要加杠的牌
  const targetTile = player.hand.find(t => t.id === tileId);
  if (!targetTile) {
    throw new Error('手牌中没有这张牌');
  }

  // 找到对应的碰
  const pengMeldIndex = player.melds.findIndex(
    m => m.type === 'peng' && isSameTile(m.tiles[0], targetTile)
  );
  if (pengMeldIndex === -1) {
    throw new Error('没有对应的碰，无法加杠');
  }

  // 从手牌移除
  player.hand = player.hand.filter(t => t.id !== targetTile.id);

  // 将碰改为杠
  const pengMeld = player.melds[pengMeldIndex];
  player.melds[pengMeldIndex] = {
    type: 'gang',
    tiles: [...pengMeld.tiles, targetTile],
    fromPlayerId: pengMeld.fromPlayerId,
  };

  // 从牌山补一张
  const wall = [...state.wall];
  if (wall.length === 0) {
    throw new Error('牌山已空');
  }
  const drawnTile = wall.pop()!;
  player.hand.push(drawnTile);

  return {
    ...state,
    players,
    wall,
    turnPhase: '等待出牌',
    lastDrawnTileId: drawnTile.id,
    lastAction: { type: 'jiagang', playerId, actionId: `jiagang-${Date.now()}` },
  };
}
