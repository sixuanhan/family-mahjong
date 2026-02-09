import type { Tile } from '../types/tile';
import type { Player } from '../types/player';

export function dealTiles(
  wall: Tile[],
  players: Player[],
  tilesPerPlayer = 13
): { wall: Tile[]; players: Player[] } {
  const newWall = [...wall];
  const newPlayers = players.map(player => ({
    ...player,
    hand: [] as Tile[],
  }));

  for (let round = 0; round < tilesPerPlayer; round++) {
    for (const player of newPlayers) {
      const tile = newWall.shift();
      if (!tile) {
        throw new Error('牌不够了');
      }
      player.hand.push(tile);
    }
  }

  return {
    wall: newWall,
    players: newPlayers,
  };
}
