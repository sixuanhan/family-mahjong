import type { Tile } from './tile';

export interface Meld {
  type: 'peng' | 'gang' | 'chi';
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
}
