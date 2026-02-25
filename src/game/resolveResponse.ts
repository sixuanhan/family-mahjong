import type { GameState } from './gameState';
import { handleRon } from './handleHu';
import { handlePeng } from './handlePeng';
import { handleMingGang } from './handleGang';
import { handleChi } from './handleChi';

/**
 * 检查是否所有响应都已完成（或超时）
 */
export function allResponsesDone(state: GameState): boolean {
  const pending = state.pendingResponses;
  if (!pending) return true;
  
  // 如果没有响应者，检查是否过了最小等待时间
  if (Object.keys(pending.responses).length === 0) {
    return Date.now() >= pending.minWaitUntil;
  }
  
  // 检查是否所有人都已响应
  return Object.values(pending.responses).every(r => r !== 'pending');
}

/**
 * 检查响应是否超时
 */
export function isResponseTimeout(state: GameState): boolean {
  const pending = state.pendingResponses;
  if (!pending) return false;
  return Date.now() >= pending.responseDeadline;
}

/**
 * 获取最高优先级的响应
 * 优先级：胡 > 碰/杠 > 吃
 * 胡的优先级按照座次顺序决定（从出牌者的下家开始）
 */
export function getWinningResponse(state: GameState): {
  playerId: string;
  action: 'hu' | 'peng' | 'gang' | 'chi';
} | null {
  const pending = state.pendingResponses;
  if (!pending) return null;

  // 1. 胡优先级最高 — 按座次（出牌者下家优先）
  const huPlayers: string[] = [];
  for (const [playerId, response] of Object.entries(pending.responses)) {
    if (response === 'hu') {
      huPlayers.push(playerId);
    }
  }
  if (huPlayers.length > 0) {
    const fromIdx = state.players.findIndex(p => p.id === pending.fromPlayerId);
    // Sort by distance from discarder in turn order
    huPlayers.sort((a, b) => {
      const aIdx = state.players.findIndex(p => p.id === a);
      const bIdx = state.players.findIndex(p => p.id === b);
      const aDist = (aIdx - fromIdx + state.players.length) % state.players.length;
      const bDist = (bIdx - fromIdx + state.players.length) % state.players.length;
      return aDist - bDist;
    });
    return { playerId: huPlayers[0], action: 'hu' };
  }

  // 2. 碰/杠优先级次之
  for (const [playerId, response] of Object.entries(pending.responses)) {
    if (response === 'peng') {
      return { playerId, action: 'peng' };
    }
    if (response === 'gang') {
      return { playerId, action: 'gang' };
    }
  }

  // 3. 吃优先级最低
  for (const [playerId, response] of Object.entries(pending.responses)) {
    if (response === 'chi') {
      return { playerId, action: 'chi' };
    }
  }

  return null;
}

/**
 * 自动将所有pending的响应标记为pass
 */
export function autoPassAll(state: GameState): GameState {
  const pending = state.pendingResponses;
  if (!pending) return state;

  const responses = { ...pending.responses };
  const timedOutHuPlayers: string[] = [];
  for (const playerId of Object.keys(responses)) {
    if (responses[playerId] === 'pending') {
      responses[playerId] = 'pass';
      // 记录超时的胡资格玩家（过水）
      if (pending.huResponders?.includes(playerId)) {
        timedOutHuPlayers.push(playerId);
      }
    }
  }

  // 为超时的胡资格玩家记录过水
  let players = state.players;
  if (timedOutHuPlayers.length > 0) {
    const tile = pending.tile;
    players = players.map(p => {
      if (!timedOutHuPlayers.includes(p.id)) return p;
      const passedHuTiles = [...(p.passedHuTiles || [])];
      if (!passedHuTiles.some(pt => pt.suit === tile.suit && pt.value === tile.value)) {
        passedHuTiles.push({ suit: tile.suit, value: tile.value });
      }
      return { ...p, passedHuTiles };
    });
  }

  return {
    ...state,
    players,
    pendingResponses: {
      ...pending,
      responses,
    },
  };
}

/**
 * 结束等待响应阶段，进入下一个玩家摸牌
 */
export function endResponsePhase(state: GameState): GameState {
  return {
    ...state,
    pendingResponses: undefined,
    turnPhase: '等待摸牌',
    currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
  };
}

/**
 * 检查chi是否被锁定（有人选了更高优先级的动作）
 */
export function isChiLocked(state: GameState): boolean {
  const pending = state.pendingResponses;
  if (!pending) return false;
  
  // 如果有人选了 hu/peng/gang，chi 就被锁定
  return Object.values(pending.responses).some(
    r => r === 'hu' || r === 'peng' || r === 'gang'
  );
}

/**
 * 提交响应（胡/碰/杠/吃/过），所有动作都先记录，等全部响应完毕后统一解析
 */
export function submitResponse(
  state: GameState,
  playerId: string,
  action: 'hu' | 'peng' | 'gang' | 'chi' | 'pass',
  chiTileIds?: [string, string]
): GameState {
  if (state.turnPhase !== '等待响应') {
    throw new Error('当前不能响应');
  }

  const pending = state.pendingResponses;
  if (!pending) throw new Error('没有待处理的响应');

  // 验证玩家有资格做此动作
  if (action === 'hu' && !pending.huResponders?.includes(playerId)) {
    throw new Error('你不能胡这张牌');
  }
  if (action === 'peng' && !pending.responders.includes(playerId)) {
    throw new Error('你不能碰这张牌');
  }
  if (action === 'gang' && !pending.gangResponders?.includes(playerId)) {
    throw new Error('你不能杠这张牌');
  }
  if (action === 'chi' && pending.chiResponder !== playerId) {
    throw new Error('你不能吃这张牌');
  }
  if (action === 'pass') {
    const canRespond =
      pending.huResponders?.includes(playerId) ||
      pending.responders.includes(playerId) ||
      pending.gangResponders?.includes(playerId) ||
      pending.chiResponder === playerId;
    if (!canRespond) {
      throw new Error('你不能回应这张牌');
    }
  }

  // 记录响应
  const responses = { ...pending.responses, [playerId]: action };

  // 过水规则：如果该玩家有胡的资格但选择了非胡动作（pass/peng/gang/chi），记录这张牌
  let players = state.players;
  if (action !== 'hu' && pending.huResponders?.includes(playerId)) {
    players = players.map(p => {
      if (p.id !== playerId) return p;
      const passedHuTiles = [...(p.passedHuTiles || [])];
      const tile = pending.tile;
      if (!passedHuTiles.some(pt => pt.suit === tile.suit && pt.value === tile.value)) {
        passedHuTiles.push({ suit: tile.suit, value: tile.value });
      }
      return { ...p, passedHuTiles };
    });
  }

  // 保存吃牌选择的牌ID
  const newChiTileIds = action === 'chi' ? chiTileIds : pending.chiTileIds;

  const newState: GameState = {
    ...state,
    players,
    pendingResponses: {
      ...pending,
      responses,
      chiTileIds: newChiTileIds,
    },
  };

  // 检查是否所有响应都已完成，或者最高优先级已确定无法被翻转
  if (allResponsesDone(newState) || canResolveEarly(newState)) {
    return resolveResponses(newState);
  }

  return newState;
}

/**
 * 检查是否可以提前解析响应（不必等待所有人响应）
 * 当最高优先级动作已确定、且剩余pending玩家无法改变结果时可以提前解析
 */
export function canResolveEarly(state: GameState): boolean {
  const pending = state.pendingResponses;
  if (!pending) return false;

  const currentBest = getWinningResponse(state);

  // 没有任何有效响应，需要等所有人都回复（可能都pass）
  if (!currentBest) return false;

  // 找出所有还在pending的玩家
  const pendingPlayerIds = Object.entries(pending.responses)
    .filter(([, r]) => r === 'pending')
    .map(([id]) => id);

  if (pendingPlayerIds.length === 0) return true; // allResponsesDone would catch this, but just in case

  if (currentBest.action === 'hu') {
    // 胡是最高优先级。但如果有另一个hu-eligible且seat更近的玩家还pending，需要等
    const fromIdx = state.players.findIndex(p => p.id === pending.fromPlayerId);
    const bestIdx = state.players.findIndex(p => p.id === currentBest.playerId);
    const bestDist = (bestIdx - fromIdx + state.players.length) % state.players.length;

    const closerHuPending = pendingPlayerIds.some(pid => {
      if (!pending.huResponders?.includes(pid)) return false;
      const pidIdx = state.players.findIndex(p => p.id === pid);
      const pidDist = (pidIdx - fromIdx + state.players.length) % state.players.length;
      return pidDist < bestDist;
    });

    return !closerHuPending;
  }

  if (currentBest.action === 'peng' || currentBest.action === 'gang') {
    // Peng/gang wins over chi. Only hu from a pending player could override.
    const huStillPending = pendingPlayerIds.some(pid =>
      pending.huResponders?.includes(pid)
    );
    return !huStillPending;
  }

  if (currentBest.action === 'chi') {
    // Chi is lowest priority. Any pending hu/peng/gang responder could override.
    const higherPriorityPending = pendingPlayerIds.some(pid =>
      pending.huResponders?.includes(pid) ||
      pending.responders.includes(pid) ||
      pending.gangResponders?.includes(pid)
    );
    return !higherPriorityPending;
  }

  return false;
}

/**
 * 统一解析所有已收集的响应，按优先级执行胜出动作
 * 优先级：胡（座次优先）> 碰/杠 > 吃
 */
export function resolveResponses(state: GameState): GameState {
  const winner = getWinningResponse(state);

  if (!winner) {
    return endResponsePhase(state);
  }

  switch (winner.action) {
    case 'hu':
      return handleRon(state, winner.playerId);
    case 'peng':
      return handlePeng(state, winner.playerId);
    case 'gang':
      return handleMingGang(state, winner.playerId);
    case 'chi': {
      const chiTileIds = state.pendingResponses?.chiTileIds;
      if (chiTileIds) {
        return handleChi(state, winner.playerId, chiTileIds, true);
      }
      return endResponsePhase(state);
    }
  }
}
