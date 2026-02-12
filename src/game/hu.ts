import type { Tile } from '../types/tile';
import type { Meld } from '../types/player';
import type { GameState } from './gameState';
import { isSameTile } from './tileUtils';

/**
 * 检查玩家是否能胡牌
 * 基本胡牌条件：4组面子（顺子/刻子）+ 1对雀头
 */
export function canHu(
  hand: Tile[],
  melds: Meld[]
): boolean {
  // 已有的面子数量
  const existingMelds = melds.length;
  // 需要从手牌中组成的面子数量
  const neededMelds = 4 - existingMelds;

  // 尝试找到雀头和面子的组合
  return checkWinningHand(hand, neededMelds);
}

/**
 * 检查手牌是否能组成指定数量的面子 + 1对雀头
 */
function checkWinningHand(tiles: Tile[], neededMelds: number): boolean {
  if (tiles.length === 0 && neededMelds === 0) {
    return true;
  }

  // 手牌数量应该是 neededMelds * 3 + 2（面子 + 雀头）
  if (tiles.length !== neededMelds * 3 + 2) {
    return false;
  }

  // 按花色和数值排序
  const sorted = sortTiles(tiles);

  // 尝试每种可能的雀头
  const tried = new Set<string>();
  for (let i = 0; i < sorted.length - 1; i++) {
    const tile = sorted[i];
    const key = `${tile.suit}-${tile.value}`;
    
    if (tried.has(key)) continue;
    tried.add(key);

    // 检查是否有对子
    if (isSameTile(tile, sorted[i + 1])) {
      // 移除雀头，检查剩余牌能否组成面子
      const remaining = [...sorted];
      remaining.splice(i, 2);
      
      if (canFormMelds(remaining, neededMelds)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 检查牌组能否组成指定数量的面子
 */
function canFormMelds(tiles: Tile[], count: number): boolean {
  if (tiles.length === 0 && count === 0) {
    return true;
  }

  if (tiles.length !== count * 3) {
    return false;
  }

  if (count === 0) {
    return tiles.length === 0;
  }

  const sorted = sortTiles(tiles);
  const first = sorted[0];

  // 尝试刻子（三张相同）
  if (sorted.length >= 3 &&
      isSameTile(first, sorted[1]) &&
      isSameTile(first, sorted[2])) {
    const remaining = sorted.slice(3);
    if (canFormMelds(remaining, count - 1)) {
      return true;
    }
  }

  // 尝试顺子（三张连续，仅限数牌）
  if (isNumberTile(first)) {
    const value = first.value as number;
    const second = sorted.find(
      t => t.suit === first.suit && t.value === value + 1
    );
    const third = sorted.find(
      t => t.suit === first.suit && t.value === value + 2 && t.id !== second?.id
    );

    if (second && third) {
      const remaining = sorted.filter(
        t => t.id !== first.id && t.id !== second.id && t.id !== third.id
      );
      if (canFormMelds(remaining, count - 1)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 检查是否是数牌
 */
function isNumberTile(tile: Tile): boolean {
  return (
    (tile.suit === 'wan' || tile.suit === 'tong' || tile.suit === 'tiao') &&
    typeof tile.value === 'number'
  );
}

/**
 * 按花色和数值排序
 */
function sortTiles(tiles: Tile[]): Tile[] {
  const suitOrder: Record<string, number> = {
    wan: 0,
    tong: 1,
    tiao: 2,
    wind: 3,
    dragon: 4,
  };

  const valueOrder: Record<string, number> = {
    east: 1,
    south: 2,
    west: 3,
    north: 4,
    red: 5,
    green: 6,
    white: 7,
  };

  return [...tiles].sort((a, b) => {
    // 先按花色
    const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
    if (suitDiff !== 0) return suitDiff;

    // 再按数值
    const aVal = typeof a.value === 'number' ? a.value : valueOrder[a.value] ?? 99;
    const bVal = typeof b.value === 'number' ? b.value : valueOrder[b.value] ?? 99;
    return aVal - bVal;
  });
}

/**
 * 检查玩家是否能荣和（别人打出的牌）
 */
export function canRon(
  state: GameState,
  playerId: string
): boolean {
  if (!state.lastDiscard) return false;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;

  // 不能荣自己打的牌
  if (state.lastDiscard.playerId === playerId) return false;

  // 手牌 + 弃牌组成完整手牌
  const handWithDiscard = [...player.hand, state.lastDiscard.tile];

  return canHu(handWithDiscard, player.melds);
}

/**
 * 检查玩家是否能自摸
 */
export function canZimo(
  state: GameState,
  playerId: string
): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;

  return canHu(player.hand, player.melds);
}
