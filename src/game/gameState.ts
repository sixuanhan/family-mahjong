import type { Tile } from '../types/tile';
import type { Player } from '../types/player';
import type { TurnPhase } from './turnPhase';

export type GamePhase =
  | 'waiting'
  | 'dealing'
  | 'playing'
  | 'finished';

export interface GameState {
  roomId: string;
  players: Player[];
  wall: Tile[];
  currentPlayerIndex: number;
  turnPhase: TurnPhase;

  lastDiscard?: {
    tile: Tile;
    playerId: string;
  };

  pendingResponses?: {
    tile: Tile;
    fromPlayerId: string;
    responders: string[]; // 有资格碰的人
    responses: Record<
      string,
      'pending' | 'pass' | 'peng'
    >;
  };
}

export type RoomPhase =
  | 'waiting_players'
  | 'waiting_ready'
  | 'playing';

export interface GameState {
  roomId: string;
  players: Player[];
  wall: Tile[];
  currentPlayerIndex: number;
  turnPhase: TurnPhase;
  roomPhase: RoomPhase;
}
