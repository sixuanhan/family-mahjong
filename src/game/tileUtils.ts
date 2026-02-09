import type { Tile } from '../types/tile';

export function isSameTile(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.value === b.value;
}
