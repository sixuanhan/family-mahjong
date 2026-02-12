import type { GameState } from './gameState';
import type { Tile } from '../types/tile';
import { isSameTile } from './tileUtils';

/**
 * 杠的类型
 */
export type GangType = 'ming' | 'an' | 'jia';

/**
 * 检查玩家是否可以明杠（别人打出的牌，自己有3张）
 */
export function canMingGang(
  state: GameState,
  playerId: string
): boolean {
  if (!state.lastDiscard) return false;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;

  // 不能杠自己打的牌
  if (state.lastDiscard.playerId === playerId) return false;

  const sameTiles = player.hand.filter(
    t => isSameTile(t, state.lastDiscard!.tile)
  );

  return sameTiles.length >= 3;
}

/**
 * 检查玩家是否可以暗杠（手牌中有4张相同的）
 * 只能在自己回合且刚摸牌后进行
 */
export function canAnGang(
  state: GameState,
  playerId: string
): Tile[] {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return [];

  // 统计每种牌的数量
  const counts = new Map<string, Tile[]>();
  for (const tile of player.hand) {
    const key = `${tile.suit}-${tile.value}`;
    if (!counts.has(key)) {
      counts.set(key, []);
    }
    counts.get(key)!.push(tile);
  }

  // 找出可以暗杠的牌
  const gangTiles: Tile[] = [];
  for (const tiles of counts.values()) {
    if (tiles.length >= 4) {
      gangTiles.push(tiles[0]); // 返回一张代表
    }
  }

  return gangTiles;
}

/**
 * 检查玩家是否可以加杠（已经碰了，又摸到第4张）
 */
export function canJiaGang(
  state: GameState,
  playerId: string
): Tile[] {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return [];

  const jiaGangTiles: Tile[] = [];

  // 遍历已有的碰
  for (const meld of player.melds) {
    if (meld.type === 'peng') {
      const pengTile = meld.tiles[0];
      // 检查手牌中是否有第4张
      const fourthTile = player.hand.find(t => isSameTile(t, pengTile));
      if (fourthTile) {
        jiaGangTiles.push(fourthTile);
      }
    }
  }

  return jiaGangTiles;
}

/**
 * 检查是否有任何杠的机会（用于自己回合）
 */
export function hasGangOpportunity(
  state: GameState,
  playerId: string
): boolean {
  return (
    canAnGang(state, playerId).length > 0 ||
    canJiaGang(state, playerId).length > 0
  );
}
