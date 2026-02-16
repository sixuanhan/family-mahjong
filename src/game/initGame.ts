import type { GameState } from './gameState';
import type { Player } from '../types/player';
import { createFullTileSet } from './createTiles';
import { shuffle } from './shuffle';
import { dealTiles } from './deal';
import { drawTile } from './draw';

export function createInitialGameState(
  roomId: string,
  players: Player[]
): GameState {
  const tiles = createFullTileSet();
  const shuffled = shuffle(tiles);

  const { wall, players: dealtPlayers } = dealTiles(shuffled, players);

    const initialState: GameState = {
    roomId,
    players: dealtPlayers,
    wall,
    currentPlayerIndex: 0,
    turnPhase: '等待摸牌',
    roomPhase: 'playing',
    playerScores: {},
    zhuangIndex: 0,
    gameNumber: 0,
    huangzhuangCount: 0,
    };

  // 第一个玩家自动摸一张牌
  return drawTile(initialState, dealtPlayers[0].id);
}
