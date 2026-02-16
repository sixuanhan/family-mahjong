import type { Tile } from '../types/tile';
import type { Meld } from '../types/player';
import type { GameState } from './gameState';
import { isSameTile } from './tileUtils';

/**
 * 胡牌结果
 */
export interface HuResult {
  canHu: boolean;
  patterns: HuPattern[];
  totalScore: number;
}

/**
 * 胡牌番型
 */
export interface HuPattern {
  name: string;
  score: number;
}

/**
 * 检查玩家是否能胡牌，并返回番数
 * 支持多种胡牌类型
 */
export function checkHu(
  hand: Tile[],
  melds: Meld[],
  options: {
    isZimo?: boolean;       // 是否自摸
    isLastTile?: boolean;   // 是否海底/河底
    consecutiveKongs?: number; // 连续杠的次数（用于杠上开花翻倍）
  } = {}
): HuResult {
  const patterns: HuPattern[] = [];
  
  // 花牌不算副露，门前清检查时排除花牌
  const nonFlowerMelds = melds.filter(m => m.type !== 'flower');
  const isMenqing = nonFlowerMelds.length === 0; // 门前清 = 无副露（花牌不算）
  
  // 收集所有牌（手牌 + 副露，不含花牌）
  const allTiles = [...hand];
  nonFlowerMelds.forEach(m => allTiles.push(...m.tiles));
  
  // 检查基本胡牌形式（花牌不算副露）
  const existingMelds = nonFlowerMelds.length;
  const neededMelds = 4 - existingMelds;
  
  // 检查七对
  const isQiDui = checkQiDui(hand);
  
  // 检查十三幺
  const isShiSanYao = checkShiSanYao(hand, nonFlowerMelds);

  const isZiYiSe = checkZiYiSe(allTiles);
  
  // 检查标准胡牌形式（4面子+1雀头）
  const isStandardHu = checkWinningHand(hand, neededMelds);
  
  if (!isStandardHu && !isQiDui && !isShiSanYao && !isZiYiSe) {
    return { canHu: false, patterns: [], totalScore: 0 };
  }
  
  // ===== 特殊牌型 =====
  
  // 十三幺 = 100
  if (isShiSanYao) {
    patterns.push({ name: '十三幺', score: 1000 });
  }
  
  // 字一色 = 100
  if (isZiYiSe) {
    patterns.push({ name: '字一色', score: 100 });
  }
  
  // 七对 = 50
  if (isQiDui) {
    patterns.push({ name: '七对', score: 50 });
  }
  
  // 全球独钓 = 50
  if (options.isLastTile) {
    patterns.push({ name: '全球独钓', score: 50 });
  }
  
  // ===== 花色番型 =====
  
  // 风碰 = 300（全部字牌且都是刻子）
  if (checkFengPeng(hand, nonFlowerMelds)) {
    patterns.push({ name: '风碰', score: 300 });
  }
  // 清一色 = 50（全部同一门数牌）
  else if (checkQingYiSe(allTiles)) {
    patterns.push({ name: '清一色', score: 50 });
  }
  // 混一色 = 30（一门数牌 + 字牌）
  else if (checkHunYiSe(allTiles)) {
    patterns.push({ name: '混一色', score: 30 });
  }
  
  // ===== 面子番型（非七对时才检查）=====
  
  if (isStandardHu && !isQiDui) {
    // 对对胡 = 30（全是刻子/杠，无顺子）
    if (checkDuiDuiHu(hand, nonFlowerMelds)) {
      patterns.push({ name: '对对胡', score: 30 });
    }
    
    // 全幺九 = 100（所有面子和雀头都带1或9或字牌）
    if (checkQuanDaiYao(hand, nonFlowerMelds)) {
      patterns.push({ name: '全幺九', score: 100 });
    }
  }
  
  // ===== 三元四喜番型 =====
  
  // 大三元 = 200
  const dragonResult = checkSanYuan(hand, nonFlowerMelds);
  if (dragonResult.daSanYuan) {
    patterns.push({ name: '大三元', score: 200 });
  }
  // 小三元 = 100
  else if (dragonResult.xiaoSanYuan) {
    patterns.push({ name: '小三元', score: 100 });
  }
  
  // 大四喜 = 300
  const windResult = checkSiXi(hand, nonFlowerMelds);
  if (windResult.daSiXi) {
    patterns.push({ name: '大四喜', score: 300 });
  }
  // 小四喜 = 200
  else if (windResult.xiaoSiXi) {
    patterns.push({ name: '小四喜', score: 200 });
  }
  
  // 平胡 = 10（仅门前清时可用）
  if (patterns.length === 0) {
    if (isMenqing) {
      patterns.push({ name: '平胡', score: 10 });
    } else {
      // 非门前清且无其他番型，不能胡
      return { canHu: false, patterns: [], totalScore: 0 };
    }
  }
  
  // 计算基础分数
  let totalScore = patterns.reduce((sum, p) => sum + p.score, 0);
  
  // 花牌加分（每朵花+1分，在翻倍前加）
  const flowerCount = melds.filter(m => m.type === 'flower').length;
  if (flowerCount > 0) {
    patterns.push({ name: `花牌x${flowerCount}`, score: flowerCount });
    totalScore += flowerCount;
  }
  
  // 杠上开花翻倍（连续杠则翻多次）
  const kongCount = options.consecutiveKongs || 0;
  if (kongCount > 0) {
    const multiplier = Math.pow(2, kongCount);
    patterns.push({ name: `杠上开花x${kongCount}`, score: totalScore * (multiplier - 1) });
    totalScore *= multiplier;
  }
  
  return { canHu: true, patterns, totalScore };
}

// ===== 番型检查辅助函数 =====

/**
 * 检查七对（7对牌，14张手牌无副露）
 */
function checkQiDui(hand: Tile[]): boolean {
  if (hand.length !== 14) return false;
  
  const sorted = sortTiles(hand);
  for (let i = 0; i < 14; i += 2) {
    if (!isSameTile(sorted[i], sorted[i + 1])) {
      return false;
    }
  }
  return true;
}

/**
 * 检查十三幺（13种幺九字牌，每种至少1张，其中1种2张作为雀头）
 */
function checkShiSanYao(hand: Tile[], melds: Meld[]): boolean {
  // 十三幺不能有副露
  if (melds.length > 0) return false;
  
  // 必须恰好14张手牌
  if (hand.length !== 14) return false;
  
  // 13种幺九字牌
  const yaoJiuTiles = [
    { suit: 'wan' as const, value: 1 },
    { suit: 'wan' as const, value: 9 },
    { suit: 'tong' as const, value: 1 },
    { suit: 'tong' as const, value: 9 },
    { suit: 'tiao' as const, value: 1 },
    { suit: 'tiao' as const, value: 9 },
    { suit: 'wind' as const, value: 'east' as const },
    { suit: 'wind' as const, value: 'south' as const },
    { suit: 'wind' as const, value: 'west' as const },
    { suit: 'wind' as const, value: 'north' as const },
    { suit: 'dragon' as const, value: 'red' as const },
    { suit: 'dragon' as const, value: 'green' as const },
    { suit: 'dragon' as const, value: 'white' as const },
  ];
  
  // 计数每种幺九字牌
  const counts: Record<string, number> = {};
  for (const yao of yaoJiuTiles) {
    const key = `${yao.suit}-${yao.value}`;
    counts[key] = 0;
  }
  
  // 统计手牌
  for (const tile of hand) {
    const key = `${tile.suit}-${tile.value}`;
    if (counts.hasOwnProperty(key)) {
      counts[key]++;
    } else {
      // 包含非幺九字的牌，不符合十三幺
      return false;
    }
  }
  
  // 检查：13种都至少1张，其中至少1种2张（作为雀头）
  let pairCount = 0;
  for (const key in counts) {
    if (counts[key] === 0) return false; // 缺少某种幺九字
    if (counts[key] === 2) pairCount++;
    if (counts[key] > 2) return false; // 某种超过2张
  }
  
  // 必须恰好1对作为雀头
  return pairCount === 1;
}

/**
 * 检查清一色（全部同一门数牌）
 */
function checkQingYiSe(tiles: Tile[]): boolean {
  const numberSuits = tiles.filter(t => 
    t.suit === 'wan' || t.suit === 'tong' || t.suit === 'tiao'
  );
  
  if (numberSuits.length !== tiles.length) return false;
  
  const suit = tiles[0]?.suit;
  return tiles.every(t => t.suit === suit);
}

/**
 * 检查混一色（一门数牌 + 字牌）
 */
function checkHunYiSe(tiles: Tile[]): boolean {
  const numberSuits = new Set<string>();
  let hasHonor = false;
  
  tiles.forEach(t => {
    if (t.suit === 'wan' || t.suit === 'tong' || t.suit === 'tiao') {
      numberSuits.add(t.suit);
    } else {
      hasHonor = true;
    }
  });
  
  // 必须有字牌，且只有一门数牌
  return hasHonor && numberSuits.size === 1;
}

/**
 * 检查字一色（全部字牌，不需要成刻子）
 */
function checkZiYiSe(tiles: Tile[]): boolean {
  return tiles.every(t => t.suit === 'wind' || t.suit === 'dragon');
}

/**
 * 检查风碰（全部字牌且所有副露都是刻子，手牌组成刻子+雀头）
 */
function checkFengPeng(hand: Tile[], melds: Meld[]): boolean {
  // 所有副露必须是碰或杠（非吃）
  const allMeldsPong = melds.every(m => m.type === 'peng' || m.type === 'gang');
  if (!allMeldsPong) return false;
  
  // 收集所有牌（手牌 + 副露）
  const allTiles = [...hand];
  melds.forEach(m => allTiles.push(...m.tiles));
  
  // 所有牌都必须是字牌
  if (!allTiles.every(t => t.suit === 'wind' || t.suit === 'dragon')) {
    return false;
  }
  
  // 检查手牌是否能组成刻子+雀头
  const neededPongs = 4 - melds.length;
  return checkAllPongs(hand, neededPongs);
}

/**
 * 检查对对胡（全是刻子/杠，无顺子）
 */
function checkDuiDuiHu(hand: Tile[], melds: Meld[]): boolean {
  // 检查副露是否都是刻子或杠（非吃）
  const allMeldsPong = melds.every(m => m.type === 'peng' || m.type === 'gang');
  if (!allMeldsPong) return false;
  
  // 检查手牌是否能组成刻子+雀头
  const neededPongs = 4 - melds.length;
  return checkAllPongs(hand, neededPongs);
}

/**
 * 检查手牌能否组成指定数量的刻子 + 雀头
 */
function checkAllPongs(tiles: Tile[], neededPongs: number): boolean {
  if (tiles.length !== neededPongs * 3 + 2) return false;
  
  const sorted = sortTiles(tiles);
  
  // 尝试每种可能的雀头
  const tried = new Set<string>();
  for (let i = 0; i < sorted.length - 1; i++) {
    const tile = sorted[i];
    const key = `${tile.suit}-${tile.value}`;
    
    if (tried.has(key)) continue;
    tried.add(key);
    
    if (isSameTile(tile, sorted[i + 1])) {
      const remaining = [...sorted];
      remaining.splice(i, 2);
      
      if (canFormAllPongs(remaining, neededPongs)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 检查牌组能否全部组成刻子
 */
function canFormAllPongs(tiles: Tile[], count: number): boolean {
  if (tiles.length === 0 && count === 0) return true;
  if (tiles.length !== count * 3) return false;
  
  const sorted = sortTiles(tiles);
  
  // 每3张必须是刻子
  for (let i = 0; i < sorted.length; i += 3) {
    if (!isSameTile(sorted[i], sorted[i + 1]) ||
        !isSameTile(sorted[i], sorted[i + 2])) {
      return false;
    }
  }
  return true;
}

/**
 * 检查全幺九（所有面子和雀头都带1或9或字牌）
 */
function checkQuanDaiYao(hand: Tile[], melds: Meld[]): boolean {
  // 检查副露
  for (const meld of melds) {
    if (!meldHasYao(meld.tiles)) return false;
  }
  
  // 简化：检查手牌中所有面子组合是否都带幺九
  // 这里用一个简单策略：所有牌要么是1/9数牌，要么是字牌
  const allTiles = [...hand];
  for (const tile of allTiles) {
    if (tile.suit === 'wan' || tile.suit === 'tong' || tile.suit === 'tiao') {
      // 数牌必须与1或9相关（在包含1或9的顺子或刻子中）
      // 简化检查：整手牌是否以幺九为主
    }
  }
  
  // 简化实现：检查是否每组3张牌都包含幺九字
  return checkHandAllYao(hand, 4 - melds.length);
}

/**
 * 检查面子是否带幺九字
 */
function meldHasYao(tiles: Tile[]): boolean {
  return tiles.some(t => isYaoJiu(t));
}

/**
 * 检查是否是幺九字牌
 */
function isYaoJiu(tile: Tile): boolean {
  if (tile.suit === 'wind' || tile.suit === 'dragon') return true;
  if (typeof tile.value === 'number') {
    return tile.value === 1 || tile.value === 9;
  }
  return false;
}

/**
 * 检查手牌所有面子是否都带幺
 */
function checkHandAllYao(hand: Tile[], neededMelds: number): boolean {
  if (hand.length !== neededMelds * 3 + 2) return false;
  
  const sorted = sortTiles(hand);
  
  // 尝试每种可能的雀头
  const tried = new Set<string>();
  for (let i = 0; i < sorted.length - 1; i++) {
    const tile = sorted[i];
    const key = `${tile.suit}-${tile.value}`;
    
    if (tried.has(key)) continue;
    tried.add(key);
    
    if (isSameTile(tile, sorted[i + 1])) {
      // 雀头必须是幺九字
      if (!isYaoJiu(tile)) continue;
      
      const remaining = [...sorted];
      remaining.splice(i, 2);
      
      if (canFormYaoMelds(remaining, neededMelds)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 检查能否组成全幺九的面子
 */
function canFormYaoMelds(tiles: Tile[], count: number): boolean {
  if (tiles.length === 0 && count === 0) return true;
  if (tiles.length !== count * 3) return false;
  
  const sorted = sortTiles(tiles);
  const first = sorted[0];
  
  // 尝试刻子
  if (sorted.length >= 3 &&
      isSameTile(first, sorted[1]) &&
      isSameTile(first, sorted[2])) {
    if (isYaoJiu(first)) {
      const remaining = sorted.slice(3);
      if (canFormYaoMelds(remaining, count - 1)) return true;
    }
  }
  
  // 尝试顺子（必须包含1或9）
  if (first.suit === 'wan' || first.suit === 'tong' || first.suit === 'tiao') {
    const value = first.value as number;
    // 只有123或789才带幺九
    if (value === 1 || value === 7) {
      const second = sorted.find(t => t.suit === first.suit && t.value === value + 1);
      const third = sorted.find(t => t.suit === first.suit && t.value === value + 2 && t.id !== second?.id);
      
      if (second && third) {
        const remaining = sorted.filter(t => 
          t.id !== first.id && t.id !== second.id && t.id !== third.id
        );
        if (canFormYaoMelds(remaining, count - 1)) return true;
      }
    }
  }
  
  return false;
}

/**
 * 检查三元（大三元/小三元）
 */
function checkSanYuan(hand: Tile[], melds: Meld[]): { daSanYuan: boolean; xiaoSanYuan: boolean } {
  const allTiles = [...hand];
  melds.forEach(m => allTiles.push(...m.tiles));
  
  const dragons = ['red', 'green', 'white'] as const;
  const dragonCounts: Record<string, number> = { red: 0, green: 0, white: 0 };
  
  allTiles.forEach(t => {
    if (t.suit === 'dragon' && typeof t.value === 'string') {
      dragonCounts[t.value]++;
    }
  });
  
  const hasPong = dragons.map(d => dragonCounts[d] >= 3);
  const hasPair = dragons.map(d => dragonCounts[d] >= 2);
  
  const pongCount = hasPong.filter(Boolean).length;
  const pairCount = hasPair.filter(Boolean).length;
  
  // 大三元：三种龙都是刻子
  if (pongCount === 3) {
    return { daSanYuan: true, xiaoSanYuan: false };
  }
  
  // 小三元：两种龙刻子 + 一种龙做雀头
  if (pongCount === 2 && pairCount === 3) {
    return { daSanYuan: false, xiaoSanYuan: true };
  }
  
  return { daSanYuan: false, xiaoSanYuan: false };
}

/**
 * 检查四喜（大四喜/小四喜）
 */
function checkSiXi(hand: Tile[], melds: Meld[]): { daSiXi: boolean; xiaoSiXi: boolean } {
  const allTiles = [...hand];
  melds.forEach(m => allTiles.push(...m.tiles));
  
  const winds = ['east', 'south', 'west', 'north'] as const;
  const windCounts: Record<string, number> = { east: 0, south: 0, west: 0, north: 0 };
  
  allTiles.forEach(t => {
    if (t.suit === 'wind' && typeof t.value === 'string') {
      windCounts[t.value]++;
    }
  });
  
  const hasPong = winds.map(w => windCounts[w] >= 3);
  const hasPair = winds.map(w => windCounts[w] >= 2);
  
  const pongCount = hasPong.filter(Boolean).length;
  const pairCount = hasPair.filter(Boolean).length;
  
  // 大四喜：四种风都是刻子
  if (pongCount === 4) {
    return { daSiXi: true, xiaoSiXi: false };
  }
  
  // 小四喜：三种风刻子 + 一种风做雀头
  if (pongCount === 3 && pairCount === 4) {
    return { daSiXi: false, xiaoSiXi: true };
  }
  
  return { daSiXi: false, xiaoSiXi: false };
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

  // 使用 checkHu 检查是否能胡（会检查番型要求）
  const result = checkHu(handWithDiscard, player.melds, { isZimo: false });
  return result.canHu;
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

  // 使用 checkHu 检查是否能胡（会检查番型要求）
  const result = checkHu(player.hand, player.melds, { isZimo: true });
  return result.canHu;
}
