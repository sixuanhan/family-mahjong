import { describe, it, expect, beforeEach } from 'vitest';
import { checkHu } from './hu';
import type { Tile } from '../types/tile';
import type { Meld } from '../types/player';
import type { Suit, TileValue } from '../types/tile';
import type { HuResult } from './hu';

// ===== Helpers =====

let _id = 0;
function resetId() { _id = 0; }
function t(suit: Suit, value: TileValue): Tile {
  return { id: `t${_id++}`, suit, value };
}
function w(v: number): Tile { return t('wan', v as TileValue); }
function b(v: number): Tile { return t('tong', v as TileValue); }
function s(v: number): Tile { return t('tiao', v as TileValue); }
function wind(v: 'east' | 'south' | 'west' | 'north'): Tile { return t('wind', v); }
function dragon(v: 'red' | 'green' | 'white'): Tile { return t('dragon', v); }
function flower(v: 'spring' | 'summer' | 'autumn' | 'winter' | 'plum' | 'orchid' | 'bamboo' | 'chrysanthemum'): Tile { return t('flower', v); }

function meld(type: Meld['type'], tiles: Tile[], fromPlayerId?: string): Meld {
  return { type, tiles, fromPlayerId };
}

/**
 * Assert exact pattern names (sorted) and exact total score.
 * For canHu=false, patterns must be empty and totalScore must be 0.
 */
function expectExact(result: HuResult, canHu: boolean, patternNames: string[], totalScore: number) {
  expect(result.canHu).toBe(canHu);
  if (!canHu) {
    expect(result.patterns).toEqual([]);
    expect(result.totalScore).toBe(0);
    return;
  }
  const actualNames = result.patterns.map(p => p.name).sort();
  const expectedNames = [...patternNames].sort();
  expect(actualNames).toEqual(expectedNames);
  expect(result.totalScore).toBe(totalScore);
}

// ===== Tests =====

describe('checkHu', () => {
  beforeEach(() => resetId());

  // ==================== Cannot Hu ====================

  describe('cannot hu', () => {
    it('random garbage hand', () => {
      const hand = [w(1), w(3), w(5), w(7), b(2), b(4), b(6), b(8), s(1), s(3), s(5), s(7), wind('east'), dragon('red')];
      expectExact(checkHu(hand, []), false, [], 0);
    });

    it('non-menqing with chi meld, no special pattern', () => {
      // Valid winning shape but non-menqing and no qualifying pattern
      const hand = [w(4), w(5), w(6), b(1), b(2), b(3), s(1), s(2), s(3), s(7), s(7)];
      const melds = [meld('chi', [w(1), w(2), w(3)], 'other')];
      expectExact(checkHu(hand, melds), false, [], 0);
    });

    it('non-menqing with peng meld, mixed suits, no special pattern', () => {
      const hand = [w(4), w(5), w(6), b(1), b(2), b(3), s(9), s(9)];
      const melds = [meld('peng', [w(1), w(1), w(1)], 'other')];
      expectExact(checkHu(hand, melds), false, [], 0);
    });

    it('non-menqing with 3 chi melds + chow hand, only pair left', () => {
      const hand = [s(1), s(2), s(3), b(5), b(5)];
      const melds = [
        meld('chi', [w(1), w(2), w(3)], 'other'),
        meld('chi', [w(4), w(5), w(6)], 'other'),
        meld('chi', [b(7), b(8), b(9)], 'other'),
      ];
      expectExact(checkHu(hand, melds), false, [], 0);
    });

    it('4 chi melds + pair in hand → 全球独钓', () => {
      const hand = [w(5), w(5)];
      const melds = [
        meld('chi', [w(1), w(2), w(3)], 'other'),
        meld('chi', [b(4), b(5), b(6)], 'other'),
        meld('chi', [s(7), s(8), s(9)], 'other'),
        meld('chi', [b(1), b(2), b(3)], 'other'),
      ];
      expectExact(checkHu(hand, melds), true, ['全球独钓'], 50);
    });
  });

  // ==================== 平胡 (Ping Hu, 10) ====================

  describe('平胡', () => {
    it('basic menqing — all chows + pair', () => {
      const hand = [
        w(1), w(2), w(3),
        w(4), w(5), w(6),
        w(7), w(8), w(9),
        b(1), b(2), b(3),
        b(5), b(5),
      ];
      expectExact(checkHu(hand, []), true, ['平胡'], 10);
    });

    it('menqing with triplet in hand (still ping hu)', () => {
      const hand = [
        w(1), w(2), w(3),
        w(4), w(5), w(6),
        b(7), b(8), b(9),
        s(3), s(3), s(3),
        b(5), b(5),
      ];
      expectExact(checkHu(hand, []), true, ['平胡'], 10);
    });

    it('menqing with three different suits', () => {
      const hand = [
        w(1), w(2), w(3),
        b(4), b(5), b(6),
        s(7), s(8), s(9),
        s(1), s(2), s(3),
        w(5), w(5),
      ];
      expectExact(checkHu(hand, []), true, ['平胡'], 10);
    });

    it('NON-menqing ping hu is rejected (peng meld)', () => {
      const hand = [
        w(4), w(5), w(6),
        b(1), b(2), b(3),
        s(7), s(7),
      ];
      const melds = [meld('peng', [w(1), w(1), w(1)], 'other')];
      expectExact(checkHu(hand, melds), false, [], 0);
    });

    it('NON-menqing ping hu is rejected (chi meld)', () => {
      const hand = [
        w(4), w(5), w(6),
        b(4), b(5), b(6),
        s(1), s(2), s(3),
        w(9), w(9),
      ];
      const melds = [meld('chi', [b(1), b(2), b(3)], 'other')];
      expectExact(checkHu(hand, melds), false, [], 0);
    });
  });

  // ==================== 七对 (Seven Pairs, 50) ====================

  describe('七对', () => {
    it('basic seven pairs', () => {
      const hand = [
        w(1), w(1), w(3), w(3), w(5), w(5), w(7), w(7),
        b(2), b(2), b(4), b(4), s(9), s(9),
      ];
      expectExact(checkHu(hand, []), true, ['七对'], 50);
    });

    it('seven pairs with honors', () => {
      const hand = [
        w(1), w(1), b(9), b(9),
        wind('east'), wind('east'), wind('south'), wind('south'),
        dragon('red'), dragon('red'), dragon('green'), dragon('green'),
        s(5), s(5),
      ];
      expectExact(checkHu(hand, []), true, ['七对'], 50);
    });

    it('flower melds do not break seven pairs (still menqing)', () => {
      const hand = [
        w(1), w(1), w(3), w(3), w(5), w(5), w(7), w(7),
        b(2), b(2), b(4), b(4), s(9), s(9),
      ];
      const melds = [meld('flower', [flower('spring')])];
      expectExact(checkHu(hand, melds), true, ['七对', '花牌x1'], 51);
    });

    it('angang (concealed kong) is allowed — counts as 2 pairs', () => {
      const hand = [
        w(1), w(1), w(3), w(3), w(5), w(5), w(7), w(7),
        b(2), b(2),
      ];
      // angang has no fromPlayerId
      const melds = [meld('gang', [w(9), w(9), w(9), w(9)])];
      expectExact(checkHu(hand, melds), true, ['七对'], 50);
    });

    it('mingang (exposed kong) breaks seven pairs → cannot hu', () => {
      const hand = [
        w(1), w(1), w(3), w(3), w(5), w(5), w(7), w(7),
        b(2), b(2),
      ];
      // mingang has fromPlayerId
      const melds = [meld('gang', [w(9), w(9), w(9), w(9)], 'other')];
      expectExact(checkHu(hand, melds), false, [], 0);
    });

    it('peng meld breaks seven pairs → cannot hu', () => {
      const hand = [
        w(1), w(1), w(3), w(3), w(5), w(5), w(7), w(7),
      ];
      const melds = [meld('peng', [w(9), w(9), w(9)], 'other')];
      expectExact(checkHu(hand, melds), false, [], 0);
    });
  });

  // ==================== 十三幺 (Thirteen Orphans, 1000) ====================

  describe('十三幺', () => {
    it('valid — 1wan pair', () => {
      const hand = [
        w(1), w(1), w(9),
        b(1), b(9),
        s(1), s(9),
        wind('east'), wind('south'), wind('west'), wind('north'),
        dragon('red'), dragon('green'), dragon('white'),
      ];
      expectExact(checkHu(hand, []), true, ['十三幺'], 1000);
    });

    it('valid — dragon white pair', () => {
      const hand = [
        w(1), w(9),
        b(1), b(9),
        s(1), s(9),
        wind('east'), wind('south'), wind('west'), wind('north'),
        dragon('red'), dragon('green'), dragon('white'), dragon('white'),
      ];
      expectExact(checkHu(hand, []), true, ['十三幺'], 1000);
    });

    it('invalid — missing one terminal (no dragon white)', () => {
      const hand = [
        w(1), w(1), w(9),
        b(1), b(9),
        s(1), s(9),
        wind('east'), wind('south'), wind('west'), wind('north'),
        dragon('red'), dragon('green'), w(1),
      ];
      const result = checkHu(hand, []);
      expect(result.patterns.some(p => p.name === '十三幺')).toBe(false);
    });

    it('invalid — has non-flower melds', () => {
      const hand = [
        w(1), w(9), b(1), b(9),
        s(1), s(9),
        wind('east'), wind('south'),
        dragon('red'), dragon('green'), dragon('white'),
      ];
      const melds = [meld('peng', [wind('west'), wind('west'), wind('west')], 'other')];
      const result = checkHu(hand, melds);
      expect(result.patterns.some(p => p.name === '十三幺')).toBe(false);
    });
  });

  // ==================== 清一色 (Full Flush, 50) ====================

  describe('清一色', () => {
    it('menqing — all wan sequences', () => {
      const hand = [
        w(1), w(2), w(3),
        w(4), w(5), w(6),
        w(7), w(8), w(9),
        w(1), w(2), w(3),
        w(9), w(9),
      ];
      expectExact(checkHu(hand, []), true, ['清一色'], 50);
    });

    it('menqing — all tong', () => {
      const hand = [
        b(1), b(2), b(3),
        b(4), b(5), b(6),
        b(7), b(8), b(9),
        b(1), b(2), b(3),
        b(9), b(9),
      ];
      expectExact(checkHu(hand, []), true, ['清一色'], 50);
    });

    it('with chi melds', () => {
      const hand = [
        s(4), s(5), s(6),
        s(8), s(8),
      ];
      const melds = [
        meld('chi', [s(1), s(2), s(3)], 'other'),
        meld('chi', [s(4), s(5), s(6)], 'other'),
        meld('chi', [s(7), s(8), s(9)], 'other'),
      ];
      expectExact(checkHu(hand, melds), true, ['清一色'], 50);
    });

    it('with peng/gang melds', () => {
      const hand = [
        w(1), w(2), w(3),
        w(7), w(7),
      ];
      const melds = [
        meld('peng', [w(4), w(4), w(4)], 'other'),
        meld('peng', [w(5), w(5), w(5)], 'other'),
        meld('gang', [w(9), w(9), w(9), w(9)], 'other'),
      ];
      expectExact(checkHu(hand, melds), true, ['清一色'], 50);
    });

    it('with melds that break the pattern → cannot hu', () => {
        const hand = [
            w(1), w(2), w(3),
            w(7), w(7),
        ];
        const melds = [
            meld('peng', [w(4), w(4), w(4)], 'other'),
            meld('peng', [b(5), b(5), b(5)], 'other'),  // breaks full flush
            meld('gang', [w(9), w(9), w(9), w(9)], 'other'),
        ];
        expectExact(checkHu(hand, melds), false, [], 0);    
    });
  });

  // ==================== 混一色 (Half Flush, 30) ====================

  describe('混一色', () => {
    it('menqing — wan + winds', () => {
      const hand = [
        w(1), w(2), w(3),
        w(4), w(5), w(6),
        w(7), w(8), w(9),
        wind('east'), wind('east'), wind('east'),
        w(5), w(5),
      ];
      expectExact(checkHu(hand, []), true, ['混一色'], 30);
    });

    it('with peng melds — wan + winds', () => {
      const hand = [
        w(7), w(8), w(9),
        wind('east'), wind('east'),
      ];
      const melds = [
        meld('peng', [w(1), w(1), w(1)], 'other'),
        meld('peng', [w(3), w(3), w(3)], 'other'),
        meld('peng', [wind('south'), wind('south'), wind('south')], 'other'),
      ];
      expectExact(checkHu(hand, melds), true, ['混一色'], 30);
    });

    it('with chi melds — tong + dragons', () => {
      const hand = [
        b(7), b(8), b(9),
        dragon('red'), dragon('red'),
      ];
      const melds = [
        meld('chi', [b(1), b(2), b(3)], 'other'),
        meld('chi', [b(4), b(5), b(6)], 'other'),
        meld('peng', [dragon('green'), dragon('green'), dragon('green')], 'other'),
      ];
      expectExact(checkHu(hand, melds), true, ['混一色'], 30);
    });
  });

  // ==================== 对对胡 (All Triplets, 30) ====================

  describe('对对胡', () => {
    it('menqing — four triplets + pair in hand', () => {
      const hand = [
        w(1), w(1), w(1),
        w(5), w(5), w(5),
        b(3), b(3), b(3),
        s(7), s(7), s(7),
        b(9), b(9),
      ];
      expectExact(checkHu(hand, []), true, ['对对胡'], 30);
    });

    it('with peng/gang melds', () => {
      const hand = [
        w(1), w(1), w(1),
        b(9), b(9),
      ];
      const melds = [
        meld('peng', [w(5), w(5), w(5)], 'other'),
        meld('peng', [b(3), b(3), b(3)], 'other'),
        meld('gang', [s(7), s(7), s(7), s(7)], 'other'),
      ];
      expectExact(checkHu(hand, melds), true, ['对对胡'], 30);
    });

    it('chi meld prevents 对对胡 → non-menqing without pattern → cannot hu', () => {
      const hand = [
        w(1), w(1), w(1),
        b(9), b(9),
      ];
      const melds = [
        meld('chi', [w(4), w(5), w(6)], 'other'),
        meld('peng', [b(3), b(3), b(3)], 'other'),
        meld('peng', [s(7), s(7), s(7)], 'other'),
      ];
      expectExact(checkHu(hand, melds), false, [], 0);
    });
  });

  // ==================== 全幺九 (All Terminals & Honors, 100) ====================

  describe('全幺九', () => {
    it('menqing — terminal pongs + honor pair', () => {
      // w111, w999, b111, s999 + EE pair
      const hand = [
        w(1), w(1), w(1),
        w(9), w(9), w(9),
        b(1), b(1), b(1),
        s(9), s(9), s(9),
        wind('east'), wind('east'),
      ];
      // 对对胡(30) + 全幺九(100) = 130
      expectExact(checkHu(hand, []), true, ['对对胡', '全幺九'], 130);
    });

    it('menqing — terminal sequences (123, 789) + honor pair', () => {
      const hand = [
        w(1), w(2), w(3),
        w(7), w(8), w(9),
        b(1), b(2), b(3),
        s(7), s(8), s(9),
        wind('east'), wind('east'),
      ];
      expectExact(checkHu(hand, []), true, ['全幺九'], 100);
    });

    it('with peng melds', () => {
      const hand = [
        w(1), w(1), w(1),
        s(9), s(9),
      ];
      const melds = [
        meld('peng', [w(9), w(9), w(9)], 'other'),
        meld('peng', [b(1), b(1), b(1)], 'other'),
        meld('peng', [wind('east'), wind('east'), wind('east')], 'other'),
      ];
      // 对对胡(30) + 全幺九(100) = 130
      expectExact(checkHu(hand, melds), true, ['对对胡', '全幺九'], 130);
    });

    it('with sequence meld (only 全幺九, not 对对胡)', () => {
      const hand = [
        w(1), w(2), w(3),
        s(9), s(9),
      ];
      const melds = [
        meld('peng', [w(1), w(1), w(1)], 'other'),
        meld('peng', [b(9), b(9), b(9)], 'other'),
        meld('peng', [wind('east'), wind('east'), wind('east')], 'other'),
      ];
      expectExact(checkHu(hand, melds), true, ['全幺九'], 100);
    });

    it('middle sequence (456) disqualifies 全幺九', () => {
      const hand = [
        w(1), w(1), w(1),
        w(4), w(5), w(6),
        b(1), b(1), b(1),
        s(9), s(9), s(9),
        wind('east'), wind('east'),
      ];
      const result = checkHu(hand, []);
      expect(result.patterns.some(p => p.name === '全幺九')).toBe(false);
    });
  });

  // ==================== 字一色 (All Honors, 100) ====================

  describe('字一色', () => {
    it('menqing — 3 wind pongs + 1 dragon pong + dragon pair', () => {
      // E,E,E + S,S,S + W,W,W + Dr,Dr,Dr + Dg,Dg
      const hand = [
        wind('east'), wind('east'), wind('east'),
        wind('south'), wind('south'), wind('south'),
        wind('west'), wind('west'), wind('west'),
        dragon('red'), dragon('red'), dragon('red'),
        dragon('green'), dragon('green'),
      ];
      // 字一色(100) + 风碰(300) + 对对胡(30) + 全幺九(100) = 530
      expectExact(checkHu(hand, []), true, ['字一色', '风碰', '对对胡', '全幺九'], 530);
    });

    it('with peng melds', () => {
      // hand: Dr,Dr,Dr + Dg,Dg; melds: peng(E), peng(S), peng(W)
      const hand = [
        dragon('red'), dragon('red'), dragon('red'),
        dragon('green'), dragon('green'),
      ];
      const melds = [
        meld('peng', [wind('east'), wind('east'), wind('east')], 'other'),
        meld('peng', [wind('south'), wind('south'), wind('south')], 'other'),
        meld('peng', [wind('west'), wind('west'), wind('west')], 'other'),
      ];
      // Same patterns, same score
      expectExact(checkHu(hand, melds), true, ['字一色', '风碰', '对对胡', '全幺九'], 530);
    });
  });

  // ==================== 大三元 (Big Three Dragons, 200) ====================

  describe('大三元', () => {
    it('menqing — 3 dragon pongs + wan chow + wan pair', () => {
      const hand = [
        dragon('red'), dragon('red'), dragon('red'),
        dragon('green'), dragon('green'), dragon('green'),
        dragon('white'), dragon('white'), dragon('white'),
        w(1), w(2), w(3),
        w(5), w(5),
      ];
      // 混一色(30) + 大三元(200) = 230
      expectExact(checkHu(hand, []), true, ['混一色', '大三元'], 230);
    });

    it('with peng melds', () => {
      const hand = [
        dragon('white'), dragon('white'), dragon('white'),
        w(1), w(2), w(3),
        w(5), w(5),
      ];
      const melds = [
        meld('peng', [dragon('red'), dragon('red'), dragon('red')], 'other'),
        meld('peng', [dragon('green'), dragon('green'), dragon('green')], 'other'),
      ];
      // 混一色(30) + 大三元(200) = 230
      expectExact(checkHu(hand, melds), true, ['混一色', '大三元'], 230);
    });
  });

  // ==================== 小三元 (Small Three Dragons, 100) ====================

  describe('小三元', () => {
    it('menqing — 2 dragon pongs + dragon pair + wan chows', () => {
      const hand = [
        dragon('red'), dragon('red'), dragon('red'),
        dragon('green'), dragon('green'), dragon('green'),
        dragon('white'), dragon('white'),
        w(1), w(2), w(3),
        w(4), w(5), w(6),
      ];
      // 混一色(30) + 小三元(100) = 130
      expectExact(checkHu(hand, []), true, ['混一色', '小三元'], 130);
    });

    it('with peng melds', () => {
      const hand = [
        dragon('white'), dragon('white'),
        w(1), w(2), w(3),
        w(4), w(5), w(6),
      ];
      const melds = [
        meld('peng', [dragon('red'), dragon('red'), dragon('red')], 'other'),
        meld('peng', [dragon('green'), dragon('green'), dragon('green')], 'other'),
      ];
      // 混一色(30) + 小三元(100) = 130
      expectExact(checkHu(hand, melds), true, ['混一色', '小三元'], 130);
    });
  });

  // ==================== 大四喜 (Big Four Winds, 300) ====================

  describe('大四喜', () => {
    it('menqing — 4 wind pongs + number pair', () => {
      const hand = [
        wind('east'), wind('east'), wind('east'),
        wind('south'), wind('south'), wind('south'),
        wind('west'), wind('west'), wind('west'),
        wind('north'), wind('north'), wind('north'),
        w(5), w(5),
      ];
      // 混一色(30) + 对对胡(30) + 大四喜(300) = 360
      expectExact(checkHu(hand, []), true, ['混一色', '对对胡', '大四喜'], 360);
    });

    it('with peng/gang melds', () => {
      const hand = [
        wind('north'), wind('north'), wind('north'),
        w(5), w(5),
      ];
      const melds = [
        meld('peng', [wind('east'), wind('east'), wind('east')], 'other'),
        meld('peng', [wind('south'), wind('south'), wind('south')], 'other'),
        meld('gang', [wind('west'), wind('west'), wind('west'), wind('west')], 'other'),
      ];
      // 混一色(30) + 对对胡(30) + 大四喜(300) = 360
      expectExact(checkHu(hand, melds), true, ['混一色', '对对胡', '大四喜'], 360);
    });
  });

  // ==================== 小四喜 (Small Four Winds, 200) ====================

  describe('小四喜', () => {
    it('menqing — 3 wind pongs + wind pair + number chow', () => {
      const hand = [
        wind('east'), wind('east'), wind('east'),
        wind('south'), wind('south'), wind('south'),
        wind('west'), wind('west'), wind('west'),
        wind('north'), wind('north'),
        w(4), w(5), w(6),
      ];
      // 混一色(30) + 小四喜(200) = 230
      expectExact(checkHu(hand, []), true, ['混一色', '小四喜'], 230);
    });

    it('with peng melds', () => {
      const hand = [
        wind('north'), wind('north'),
        w(4), w(5), w(6),
      ];
      const melds = [
        meld('peng', [wind('east'), wind('east'), wind('east')], 'other'),
        meld('peng', [wind('south'), wind('south'), wind('south')], 'other'),
        meld('peng', [wind('west'), wind('west'), wind('west')], 'other'),
      ];
      // 混一色(30) + 小四喜(200) = 230
      expectExact(checkHu(hand, melds), true, ['混一色', '小四喜'], 230);
    });
  });

  // ==================== 全球独钓 (Last Tile, 50) ====================

  describe('全球独钓', () => {
    it('1 tile in hand + 4 melds → 全球独钓(50)', () => {
        // Only a pair in hand (1 tile + drawn winning tile), 4 exposed melds
        const hand = [w(5), w(5)];
        const melds = [
            meld('peng', [w(1), w(1), w(1)], 'other'),
            meld('chi', [b(3), b(4), b(5)], 'other'),
            meld('gang', [s(7), s(7), s(7), s(7)], 'other'),
            meld('chi', [s(3), s(4), s(5)], 'other'),
        ];
        expectExact(checkHu(hand, melds), true, ['全球独钓'], 50);
    });

    it('1 tile in hand + 4 melds → 对对胡(30) + 全球独钓(50) = 80', () => {
      // Only a pair in hand (1 tile + drawn winning tile), 4 exposed melds
      const hand = [dragon('red'), dragon('red')];
      const melds = [
        meld('peng', [w(1), w(1), w(1)], 'other'),
        meld('peng', [b(3), b(3), b(3)], 'other'),
        meld('peng', [s(7), s(7), s(7)], 'other'),
        meld('peng', [w(9), w(9), w(9)], 'other'),
      ];
      expectExact(checkHu(hand, melds), true, ['对对胡', '全球独钓'], 80);
    });

    it('stacks with 清一色 + 对对胡 — 50 + 30 + 50 = 130', () => {
      const hand = [w(5), w(5)];
      const melds = [
        meld('peng', [w(1), w(1), w(1)], 'other'),
        meld('peng', [w(3), w(3), w(3)], 'other'),
        meld('peng', [w(7), w(7), w(7)], 'other'),
        meld('gang', [w(9), w(9), w(9), w(9)], 'other'),
      ];
      expectExact(checkHu(hand, melds), true, ['清一色', '对对胡', '全球独钓'], 130);
    });
  });

  // ==================== 花牌 (Flower Bonus) ====================

  describe('花牌', () => {
    it('1 flower adds 1 to 平胡 — 10 + 1 = 11', () => {
      const hand = [
        w(1), w(2), w(3),
        w(4), w(5), w(6),
        w(7), w(8), w(9),
        b(1), b(2), b(3),
        b(5), b(5),
      ];
      const melds = [meld('flower', [flower('plum')])];
      expectExact(checkHu(hand, melds), true, ['平胡', '花牌x1'], 11);
    });

    it('2 flowers add 2 to 平胡 — 10 + 2 = 12', () => {
      const hand = [
        w(1), w(2), w(3),
        w(4), w(5), w(6),
        w(7), w(8), w(9),
        b(1), b(2), b(3),
        b(5), b(5),
      ];
      const melds = [
        meld('flower', [flower('spring')]),
        meld('flower', [flower('summer')]),
      ];
      expectExact(checkHu(hand, melds), true, ['平胡', '花牌x2'], 12);
    });

    it('flowers do not break menqing', () => {
      const hand = [
        w(1), w(2), w(3),
        w(4), w(5), w(6),
        w(7), w(8), w(9),
        b(1), b(2), b(3),
        b(5), b(5),
      ];
      const melds = [
        meld('flower', [flower('spring')]),
        meld('flower', [flower('summer')]),
        meld('flower', [flower('autumn')]),
      ];
      // 平胡(10) + 花牌x3(3) = 13
      expectExact(checkHu(hand, melds), true, ['平胡', '花牌x3'], 13);
    });
  });

  // ==================== 杠上开花 (Kong Bloom) ====================

  describe('杠上开花', () => {
    it('×2 on 平胡 — 10 × 2 = 20', () => {
      const hand = [
        w(1), w(2), w(3),
        w(4), w(5), w(6),
        w(7), w(8), w(9),
        b(1), b(2), b(3),
        b(5), b(5),
      ];
      expectExact(checkHu(hand, [], { consecutiveKongs: 1 }), true, ['平胡', '杠上开花x1'], 20);
    });

    it('×4 on 平胡 (2 consecutive kongs) — 10 × 4 = 40', () => {
      const hand = [
        w(1), w(2), w(3),
        w(4), w(5), w(6),
        w(7), w(8), w(9),
        b(1), b(2), b(3),
        b(5), b(5),
      ];
      expectExact(checkHu(hand, [], { consecutiveKongs: 2 }), true, ['平胡', '杠上开花x2'], 40);
    });

    it('×2 on 对对胡 — 30 × 2 = 60', () => {
      const hand = [
        w(1), w(1), w(1),
        w(5), w(5), w(5),
        b(3), b(3), b(3),
        s(7), s(7), s(7),
        b(9), b(9),
      ];
      expectExact(checkHu(hand, [], { consecutiveKongs: 1 }), true, ['对对胡', '杠上开花x1'], 60);
    });

    it('flowers added BEFORE kong multiplier: (10 + 2) × 2 = 24', () => {
      const hand = [
        w(1), w(2), w(3),
        w(4), w(5), w(6),
        w(7), w(8), w(9),
        b(1), b(2), b(3),
        b(5), b(5),
      ];
      const melds = [
        meld('flower', [flower('spring')]),
        meld('flower', [flower('summer')]),
      ];
      expectExact(
        checkHu(hand, melds, { consecutiveKongs: 1 }),
        true,
        ['平胡', '花牌x2', '杠上开花x1'],
        24,
      );
    });
  });

  // ==================== Pattern Stacking ====================

  describe('pattern stacking', () => {
    it('清一色 + 对对胡 = 80', () => {
      const hand = [
        w(1), w(1), w(1),
        w(3), w(3), w(3),
        w(5), w(5), w(5),
        w(7), w(7), w(7),
        w(9), w(9),
      ];
      // 清一色(50) + 对对胡(30) = 80 (全幺九 fails because w3,w5,w7 not yaoJiu)
      expectExact(checkHu(hand, []), true, ['清一色', '对对胡'], 80);
    });

    it('清一色 + 对对胡 with melds = 80', () => {
      const hand = [
        w(1), w(1), w(1),
        w(9), w(9),
      ];
      const melds = [
        meld('peng', [w(3), w(3), w(3)], 'other'),
        meld('peng', [w(5), w(5), w(5)], 'other'),
        meld('peng', [w(7), w(7), w(7)], 'other'),
      ];
      expectExact(checkHu(hand, melds), true, ['清一色', '对对胡'], 80);
    });

    it('混一色 + 对对胡 with melds = 60', () => {
      const hand = [
        w(1), w(1), w(1),
        wind('east'), wind('east'),
      ];
      const melds = [
        meld('peng', [w(3), w(3), w(3)], 'other'),
        meld('peng', [w(5), w(5), w(5)], 'other'),
        meld('peng', [wind('south'), wind('south'), wind('south')], 'other'),
      ];
      expectExact(checkHu(hand, melds), true, ['混一色', '对对胡'], 60);
    });

    it('七对 + 清一色 = 100', () => {
      const hand = [
        w(1), w(1), w(2), w(2), w(3), w(3), w(4), w(4),
        w(5), w(5), w(6), w(6), w(7), w(7),
      ];
      expectExact(checkHu(hand, []), true, ['七对', '清一色'], 100);
    });

    it('七对 + 混一色 = 80', () => {
      const hand = [
        w(1), w(1), w(3), w(3), w(5), w(5), w(7), w(7),
        w(9), w(9), wind('east'), wind('east'), dragon('red'), dragon('red'),
      ];
      expectExact(checkHu(hand, []), true, ['七对', '混一色'], 80);
    });
  });

  // ==================== Edge Cases ====================

  describe('edge cases', () => {
    it('only pair in hand with 4 peng/gang melds → 对对胡 + 混一色 + 全球独钓', () => {
      const hand = [dragon('white'), dragon('white')];
      const melds = [
        meld('peng', [w(1), w(1), w(1)], 'other'),
        meld('peng', [w(3), w(3), w(3)], 'other'),
        meld('peng', [w(5), w(5), w(5)], 'other'),
        meld('gang', [w(7), w(7), w(7), w(7)], 'other'),
      ];
      const result = checkHu(hand, melds);
      expect(result.canHu).toBe(true);
      expect(result.patterns.some(p => p.name === '对对胡')).toBe(true);
      expect(result.patterns.some(p => p.name === '混一色')).toBe(true);
      expect(result.patterns.some(p => p.name === '全球独钓')).toBe(true);
      expect(result.totalScore).toBe(110);
    });

    it('hand parseable as both 七对 and standard hu prefers higher score', () => {
      const hand = [
        w(1), w(1), w(2), w(2), w(3), w(3),
        w(4), w(4), w(5), w(5), w(6), w(6),
        w(7), w(7),
      ];
      const result = checkHu(hand, []);
      expect(result.canHu).toBe(true);
      // Gets both 七对 and 清一色
      expect(result.patterns.some(p => p.name === '七对')).toBe(true);
      expect(result.patterns.some(p => p.name === '清一色')).toBe(true);
      expect(result.totalScore).toBe(100);
    });
  });
});
