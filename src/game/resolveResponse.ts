import type { GameState } from './gameState';

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
 */
export function getWinningResponse(state: GameState): {
  playerId: string;
  action: 'hu' | 'peng' | 'gang' | 'chi';
} | null {
  const pending = state.pendingResponses;
  if (!pending) return null;

  // 1. 胡优先级最高
  for (const [playerId, response] of Object.entries(pending.responses)) {
    if (response === 'hu') {
      return { playerId, action: 'hu' };
    }
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
  for (const playerId of Object.keys(responses)) {
    if (responses[playerId] === 'pending') {
      responses[playerId] = 'pass';
    }
  }

  return {
    ...state,
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
