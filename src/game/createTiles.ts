import type { Tile, Suit, TileValue } from '../types/tile';

let tileIdCounter = 0;

function createTile(suit: Suit, value: TileValue): Tile {
  return {
    id: `tile-${tileIdCounter++}`,
    suit,
    value,
  };
}

export function createFullTileSet(): Tile[] {
  const tiles: Tile[] = [];

  // 万 / 饼 / 条
  const suits: Suit[] = ['wan', 'tong', 'tiao'];
  for (const suit of suits) {
    for (let value = 1; value <= 9; value++) {
      for (let i = 0; i < 4; i++) {
        tiles.push(createTile(suit, value as TileValue));
      }
    }
  }

  // 风牌
  const winds: TileValue[] = ['east', 'south', 'west', 'north'];
  for (const wind of winds) {
    for (let i = 0; i < 4; i++) {
      tiles.push(createTile('wind', wind));
    }
  }

  // 箭牌
  const dragons: TileValue[] = ['red', 'green', 'white'];
  for (const dragon of dragons) {
    for (let i = 0; i < 4; i++) {
      tiles.push(createTile('dragon', dragon));
    }
  }

  // 花牌（8张，每种1张）
  const flowers: TileValue[] = [
    'spring', 'summer', 'autumn', 'winter',  // 四季
    'plum', 'orchid', 'bamboo', 'chrysanthemum',  // 四君子
  ];
  for (const flower of flowers) {
    tiles.push(createTile('flower', flower));
  }

  return tiles;
}
