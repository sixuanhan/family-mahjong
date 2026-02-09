import type { Tile } from '../types/tile';

export type Action =
  | { type: 'DRAW'; playerId: string; tile: Tile }
  | { type: 'DISCARD'; playerId: string; tile: Tile }
  | { type: 'PENG'; playerId: string; tiles: Tile[] }
  | { type: 'GANG'; playerId: string; tiles: Tile[] }
  | { type: 'CHI'; playerId: string; tiles: Tile[] }
  | { type: 'PASS'; playerId: string };
