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
  | 'rolling_dice'    // 掷骰子决定庄家
  | 'playing'
  | 'settling'        // 结算分数
  | 'competition_end'; // 比赛结束

export interface DiceRoll {
  playerId: string;
  dice: [number, number]; // 两个骰子
  total: number;
}

export interface WinnerInfo {
  playerId: string;
  winType: 'ron' | 'zimo';
  winningTile: Tile;
  fromPlayerId?: string; // 荣和时，放炮的人
  patterns?: { name: string; score: number }[]; // 胡牌番型
  totalScore?: number; // 总分数
}

export interface ScoreChange {
  playerId: string;
  change: number;
  reason: string;
}

export interface GameState {
  roomId: string;
  players: Player[];
  wall: Tile[];
  currentPlayerIndex: number;
  turnPhase: TurnPhase;
  roomPhase: RoomPhase;

  // 比赛状态
  playerScores: Record<string, number>; // 每个玩家的分数
  zhuangIndex: number;                   // 庄家索引
  gameNumber: number;                    // 当前第几局
  huangzhuangCount: number;              // 连续荒庄次数（用于翻倍）
  diceRolls?: DiceRoll[];               // 掷骰子结果
  diceRollEligible?: string[];          // 当前轮有资格掷骰子的玩家ID（用于平局重掷）
  scoreChanges?: ScoreChange[];         // 本局分数变化
  competitionWinner?: string;           // 比赛获胜者ID
  isHuangzhuang?: boolean;              // 本局是否荒庄

  // 投票
  restartGameVotes?: string[];          // 想重开本局的玩家ID
  restartCompetitionVotes?: string[];   // 想重开比赛的玩家ID
  nextGameVotes?: string[];             // 投票下一局的玩家ID

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
    responseDeadline: number;  // 响应截止时间戳
    minWaitUntil: number;      // 最小等待时间戳（2秒观看牌）
    chiTileIds?: [string, string]; // 吃牌时选择的两张牌ID
  };

  lastDrawnTileId?: string; // 最近摸到的牌

  lastAction?: {
    type: 'chi' | 'peng' | 'gang' | 'angang' | 'jiagang' | 'flower' | 'hu' | 'zimo';
    playerId: string;
    actionId: string; // unique ID to detect changes
  };

  winner?: WinnerInfo;
}
