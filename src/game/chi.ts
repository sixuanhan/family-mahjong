import type { GameState } from './gameState';
import type { Tile } from '../types/tile';

/**
 * 检查玩家是否可以吃
 * 吃只能由下家执行，且只能吃数牌（万、筒、条）
 */
export function canChi(
  state: GameState,
  playerId: string
): boolean {
  if (!state.lastDiscard) return false;

  const discardedTile = state.lastDiscard.tile;

  // 只有数牌可以吃
  if (!isNumberTile(discardedTile)) return false;

  // 检查是否是下家
  const discardPlayerIndex = state.players.findIndex(
    p => p.id === state.lastDiscard!.playerId
  );
  const chiPlayerIndex = state.players.findIndex(p => p.id === playerId);
  const nextPlayerIndex = (discardPlayerIndex + 1) % state.players.length;

  if (chiPlayerIndex !== nextPlayerIndex) return false;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;

  // 检查是否有可以组成顺子的牌
  const options = getChiOptions(player.hand, discardedTile);
  return options.length > 0;
}

/**
 * 检查是否是数牌（万、筒、条）
 */
export function isNumberTile(tile: Tile): boolean {
  return (
    (tile.suit === 'wan' || tile.suit === 'tong' || tile.suit === 'tiao') &&
    typeof tile.value === 'number'
  );
}

/**
 * 获取所有可以吃的选项
 * 返回所有可能的顺子组合（用手牌中的两张 + 弃牌）
 */
export function getChiOptions(
  hand: Tile[],
  discardedTile: Tile
): { tiles: [Tile, Tile]; pattern: string }[] {
  if (!isNumberTile(discardedTile)) return [];

  const suit = discardedTile.suit;
  const value = discardedTile.value as number;
  const options: { tiles: [Tile, Tile]; pattern: string }[] = [];

  // 同花色的所有牌
  const sameSuitTiles = hand.filter(
    t => t.suit === suit && typeof t.value === 'number'
  );

  // 三种可能的顺子模式：
  // 1. 弃牌是最小的: [弃牌, 弃牌+1, 弃牌+2]
  // 2. 弃牌是中间的: [弃牌-1, 弃牌, 弃牌+1]
  // 3. 弃牌是最大的: [弃牌-2, 弃牌-1, 弃牌]

  // 模式1: 需要 value+1 和 value+2
  if (value <= 7) {
    const tile1 = sameSuitTiles.find(t => t.value === value + 1);
    const tile2 = sameSuitTiles.find(
      t => t.value === value + 2 && t.id !== tile1?.id
    );
    if (tile1 && tile2) {
      options.push({
        tiles: [tile1, tile2],
        pattern: `${value}${value + 1}${value + 2}`,
      });
    }
  }

  // 模式2: 需要 value-1 和 value+1
  if (value >= 2 && value <= 8) {
    const tile1 = sameSuitTiles.find(t => t.value === value - 1);
    const tile2 = sameSuitTiles.find(
      t => t.value === value + 1 && t.id !== tile1?.id
    );
    if (tile1 && tile2) {
      options.push({
        tiles: [tile1, tile2],
        pattern: `${value - 1}${value}${value + 1}`,
      });
    }
  }

  // 模式3: 需要 value-2 和 value-1
  if (value >= 3) {
    const tile1 = sameSuitTiles.find(t => t.value === value - 2);
    const tile2 = sameSuitTiles.find(
      t => t.value === value - 1 && t.id !== tile1?.id
    );
    if (tile1 && tile2) {
      options.push({
        tiles: [tile1, tile2],
        pattern: `${value - 2}${value - 1}${value}`,
      });
    }
  }

  return options;
}
