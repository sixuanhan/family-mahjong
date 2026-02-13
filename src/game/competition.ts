import type { GameState, DiceRoll, ScoreChange } from './gameState';
import { createFullTileSet } from './createTiles';
import { shuffle } from './shuffle';
import { dealTiles } from './deal';
import { drawTile } from './draw';

const INITIAL_SCORE = 250;
const HUANGZHUANG_THRESHOLD = 32; // 牌山剩余32张时荒庄

/**
 * 初始化比赛状态（所有玩家准备好后调用）
 */
export function initCompetition(state: GameState): GameState {
  const playerScores: Record<string, number> = {};
  state.players.forEach(p => {
    playerScores[p.id] = INITIAL_SCORE;
  });

  return {
    ...state,
    roomPhase: 'rolling_dice',
    playerScores,
    zhuangIndex: 0,
    gameNumber: 1,
    huangzhuangCount: 0,
    diceRolls: [],
    diceRollEligible: state.players.map(p => p.id), // 初始所有玩家都可以掷
  };
}

/**
 * 玩家掷骰子
 */
export function rollDice(state: GameState, playerId: string): GameState {
  if (state.roomPhase !== 'rolling_dice') {
    throw new Error('当前不是掷骰子阶段');
  }

  const eligible = state.diceRollEligible || state.players.map(p => p.id);
  
  // 检查是否有资格掷
  if (!eligible.includes(playerId)) {
    throw new Error('你没有资格掷骰子');
  }

  // 检查本轮是否已经掷过
  const currentRoundRolls = state.diceRolls?.filter(r => eligible.includes(r.playerId)) || [];
  if (currentRoundRolls.some(r => r.playerId === playerId)) {
    throw new Error('你已经掷过骰子了');
  }

  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = Math.floor(Math.random() * 6) + 1;

  const roll: DiceRoll = {
    playerId,
    dice: [dice1, dice2],
    total: dice1 + dice2,
  };

  const diceRolls = [...(state.diceRolls || []), roll];
  const thisRoundRolls = diceRolls.filter(r => eligible.includes(r.playerId));

  // 检查本轮所有有资格的玩家是否都掷完了
  if (thisRoundRolls.length === eligible.length) {
    // 找出本轮最大点数
    const maxRoll = Math.max(...thisRoundRolls.map(r => r.total));
    const winners = thisRoundRolls.filter(r => r.total === maxRoll);
    
    if (winners.length === 1) {
      // 只有一个获胜者，确定庄家
      const zhuangId = winners[0].playerId;
      const zhuangIndex = state.players.findIndex(p => p.id === zhuangId);

      // 开始游戏
      return startGame({
        ...state,
        diceRolls,
        zhuangIndex,
        diceRollEligible: undefined,
      });
    } else {
      // 平局，需要重掷
      return {
        ...state,
        diceRolls,
        diceRollEligible: winners.map(w => w.playerId),
      };
    }
  }

  return {
    ...state,
    diceRolls,
  };
}

/**
 * 开始新一局游戏
 */
export function startGame(state: GameState): GameState {
  const tiles = createFullTileSet();
  const shuffled = shuffle(tiles);

  // 重置玩家手牌等
  const resetPlayers = state.players.map(p => ({
    ...p,
    hand: [],
    melds: [],
    discards: [],
  }));

  const { wall, players: dealtPlayers } = dealTiles(shuffled, resetPlayers);

  // 庄家先摸牌
  const initialState: GameState = {
    ...state,
    players: dealtPlayers,
    wall,
    currentPlayerIndex: state.zhuangIndex,
    turnPhase: '等待摸牌',
    roomPhase: 'playing',
    lastDiscard: undefined,
    pendingResponses: undefined,
    lastDrawnTileId: undefined,
    winner: undefined,
    scoreChanges: undefined,
    isHuangzhuang: undefined,
  };

  // 庄家自动摸一张牌
  return drawTile(initialState, dealtPlayers[state.zhuangIndex].id);
}

/**
 * 结算分数
 */
export function settleScores(state: GameState): GameState {
  if (!state.winner) {
    throw new Error('没有胜者无法结算');
  }

  const { winner, players, zhuangIndex, playerScores, huangzhuangCount } = state;
  const winnerId = winner.playerId;
  const baseScore = winner.totalScore || 10;
  const isZhuangWinner = players[zhuangIndex].id === winnerId;
  
  // 荒庄翻倍器（2^连续荒庄次数）
  const huangzhuangMultiplier = Math.pow(2, huangzhuangCount || 0);

  const newScores = { ...playerScores };
  const scoreChanges: ScoreChange[] = [];

  if (winner.winType === 'zimo') {
    // 自摸：所有其他玩家给赢家付分
    for (const player of players) {
      if (player.id === winnerId) continue;

      const isZhuang = players[zhuangIndex].id === player.id;
      // 庄家付/收双倍，再乘以荒庄翻倍
      const zhuangMultiplier = isZhuang || isZhuangWinner ? 2 : 1;
      const loss = baseScore * zhuangMultiplier * huangzhuangMultiplier;

      newScores[player.id] -= loss;
      newScores[winnerId] += loss;

      scoreChanges.push({
        playerId: player.id,
        change: -loss,
        reason: isZhuang ? '自摸（庄家双倍）' : '自摸',
      });
    }

    const totalGain = players
      .filter(p => p.id !== winnerId)
      .reduce((sum, p) => {
        const isZhuang = players[zhuangIndex].id === p.id;
        const zhuangMult = isZhuang || isZhuangWinner ? 2 : 1;
        return sum + baseScore * zhuangMult * huangzhuangMultiplier;
      }, 0);

    scoreChanges.push({
      playerId: winnerId,
      change: totalGain,
      reason: '自摸胡牌',
    });
  } else {
    // 荣和：放炮者付分
    const loserId = winner.fromPlayerId!;
    const isLoserZhuang = players[zhuangIndex].id === loserId;
    // 庄家相关翻倍，再乘以荒庄翻倍
    const zhuangMultiplier = isLoserZhuang || isZhuangWinner ? 2 : 1;
    const loss = baseScore * zhuangMultiplier * huangzhuangMultiplier;

    newScores[loserId] -= loss;
    newScores[winnerId] += loss;

    scoreChanges.push({
      playerId: loserId,
      change: -loss,
      reason: isLoserZhuang ? '放炮（庄家双倍）' : '放炮',
    });
    scoreChanges.push({
      playerId: winnerId,
      change: loss,
      reason: '荣和胡牌',
    });
  }

  // 检查是否有人分数<=0（比赛结束）
  const bankruptPlayer = players.find(p => newScores[p.id] <= 0);
  let competitionWinner: string | undefined;
  let newRoomPhase = state.roomPhase;

  if (bankruptPlayer) {
    // 比赛结束，找出分数最高的玩家
    const maxScore = Math.max(...Object.values(newScores));
    competitionWinner = Object.keys(newScores).find(id => newScores[id] === maxScore);
    newRoomPhase = 'competition_end';
  } else {
    newRoomPhase = 'settling';
  }

  // 庄家轮换：如果庄家没赢，庄家向右（下一个玩家）
  let newZhuangIndex = zhuangIndex;
  if (!isZhuangWinner) {
    newZhuangIndex = (zhuangIndex + 1) % players.length;
  }

  return {
    ...state,
    playerScores: newScores,
    scoreChanges,
    zhuangIndex: newZhuangIndex,
    roomPhase: newRoomPhase,
    competitionWinner,
    huangzhuangCount: 0, // 有人胡牌，重置荒庄计数
  };
}

/**
 * 开始下一局
 */
export function nextGame(state: GameState): GameState {
  if (state.roomPhase !== 'settling') {
    throw new Error('当前不能开始下一局');
  }

  return startGame({
    ...state,
    gameNumber: state.gameNumber + 1,
    diceRolls: undefined,
    scoreChanges: undefined,
  });
}

/**
 * 检查是否荒庄（牌山剩余32张且无人胡牌）
 */
export function checkHuangzhuang(state: GameState): boolean {
  return state.wall.length <= HUANGZHUANG_THRESHOLD && !state.winner;
}

/**
 * 处理荒庄
 */
export function handleHuangzhuang(state: GameState): GameState {
  const newHuangzhuangCount = (state.huangzhuangCount || 0) + 1;
  
  return {
    ...state,
    turnPhase: '游戏结束',
    roomPhase: 'settling',
    isHuangzhuang: true,
    huangzhuangCount: newHuangzhuangCount,
    scoreChanges: [], // 荒庄无分数变化
  };
}

/**
 * 投票重开本局
 */
export function voteRestartGame(state: GameState, playerId: string): GameState {
  const votes = state.restartGameVotes || [];
  
  // 切换投票状态
  const hasVoted = votes.includes(playerId);
  const newVotes = hasVoted
    ? votes.filter(id => id !== playerId)
    : [...votes, playerId];
  
  // 检查是否所有玩家都同意
  if (newVotes.length === state.players.length) {
    // 重开本局（保持庄家不变，分数不变）
    return startGame({
      ...state,
      restartGameVotes: undefined,
      restartCompetitionVotes: undefined,
    });
  }
  
  return {
    ...state,
    restartGameVotes: newVotes,
  };
}

/**
 * 投票重开比赛
 */
export function voteRestartCompetition(state: GameState, playerId: string): GameState {
  const votes = state.restartCompetitionVotes || [];
  
  // 切换投票状态
  const hasVoted = votes.includes(playerId);
  const newVotes = hasVoted
    ? votes.filter(id => id !== playerId)
    : [...votes, playerId];
  
  // 检查是否所有玩家都同意
  if (newVotes.length === state.players.length) {
    // 重开比赛
    return initCompetition({
      ...state,
      restartGameVotes: undefined,
      restartCompetitionVotes: undefined,
    });
  }
  
  return {
    ...state,
    restartCompetitionVotes: newVotes,
  };
}
