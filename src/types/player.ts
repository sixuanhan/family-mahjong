import type { Tile } from './tile';

export interface Meld {
  type: 'peng' | 'gang' | 'chi' | 'flower';
  tiles: Tile[];
  fromPlayerId?: string;
}

export interface Player {
  id: string;
  name: string;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  isReady: boolean;
  isOnline: boolean;
  passedHuTiles?: { suit: string; value: string | number }[]; // 过水：跳过胡的牌，下次摸牌前不能胡同样的牌
}
