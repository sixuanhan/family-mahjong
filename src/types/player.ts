import type { Tile } from './tile';

export interface Meld {
  type: 'peng' | 'gang' | 'chi';
  tiles: Tile[];
  fromPlayerId?: string;
}

export interface Player {
  id: string;
  name: string;

  hand: Tile[];        // 手牌
  melds: Meld[];       // 吃 / 碰 / 杠
  discards: Tile[];    // 已打出的牌

  isReady: boolean;
  isOnline: boolean;
}
