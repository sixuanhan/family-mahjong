import type { GameState } from './gameState';
import { isSameTile } from './tileUtils';

export function canPeng(
  state: GameState,
  playerId: string
): boolean {
  if (!state.lastDiscard) return false;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;

  const sameTiles = player.hand.filter(
    t => isSameTile(t, state.lastDiscard!.tile)
  );

  return sameTiles.length >= 2;
}
