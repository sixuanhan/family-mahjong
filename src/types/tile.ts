// 花色
export type Suit = 'wan' | 'tong' | 'tiao' | 'wind' | 'dragon';

// 数值
export type TileValue =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  | 'east' | 'south' | 'west' | 'north'
  | 'red' | 'green' | 'white';

// 单张麻将牌
export interface Tile {
  id: string;        // 唯一 ID（用于区分两张一样的牌）
  suit: Suit;
  value: TileValue;
}
