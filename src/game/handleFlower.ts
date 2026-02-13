import type { GameState } from './gameState';
import type { Tile } from '../types/tile';

/**
 * 检查玩家手中是否有花牌可以打出
 */
export function canPlayFlower(state: GameState, playerId: string): Tile[] {
  if (state.turnPhase !== '等待出牌') {
    return [];
  }

  const player = state.players.find(p => p.id === playerId);
  if (!player) {
    return [];
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    return [];
  }

  // 返回手中所有花牌
  return player.hand.filter(t => t.suit === 'flower');
}

/**
 * 处理打花（补花）
 * 将花牌放入副露区，从牌山末尾补一张
 */
export function handleFlower(
  state: GameState,
  playerId: string,
  tileId: string
): GameState {
  if (state.turnPhase !== '等待出牌') {
    throw new Error('只能在出牌阶段补花');
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error('不是当前玩家');
  }

  const players = state.players.map(p => ({ ...p, hand: [...p.hand], melds: [...p.melds] }));
  const player = players[state.currentPlayerIndex];

  // 找到要补的花牌
  const flowerTile = player.hand.find(t => t.id === tileId);
  if (!flowerTile) {
    throw new Error('手牌中没有这张牌');
  }

  if (flowerTile.suit !== 'flower') {
    throw new Error('只能补花牌');
  }

  // 从手牌移除花牌
  player.hand = player.hand.filter(t => t.id !== tileId);

  // 加入副露区
  player.melds.push({
    type: 'flower',
    tiles: [flowerTile],
  });

  // 从牌山末尾补一张
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
  };
}
