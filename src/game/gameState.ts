import type { Tile } from '../types/tile';
import type { Player } from '../types/player';
import type { TurnPhase } from './turnPhase';

export type GamePhase =
  | 'waiting'
  | 'dealing'
  | 'playing'
  | 'finished';

export type RoomPhase =
  | 'waiting_players'
  | 'waiting_ready'
  | 'playing';

export interface WinnerInfo {
  playerId: string;
  winType: 'ron' | 'zimo';
  winningTile: Tile;
  fromPlayerId?: string; // 荣和时，放炮的人
}

export interface GameState {
  roomId: string;
  players: Player[];
  wall: Tile[];
  currentPlayerIndex: number;
  turnPhase: TurnPhase;
  roomPhase: RoomPhase;

  lastDiscard?: {
    tile: Tile;
    playerId: string;
  };

  pendingResponses?: {
    tile: Tile;
    fromPlayerId: string;
    responders: string[]; // 有资格碰的人
    gangResponders?: string[]; // 有资格明杠的人
    chiResponder?: string; // 有资格吃的人（只有下家）
    huResponders?: string[]; // 有资格胡的人
    responses: Record<
      string,
      'pending' | 'pass' | 'peng' | 'gang' | 'chi' | 'hu'
    >;
  };

  winner?: WinnerInfo;
}
