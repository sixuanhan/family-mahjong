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

  // 万 / 筒 / 条
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

  return tiles;
}
