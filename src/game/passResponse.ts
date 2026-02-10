import type { GameState } from './gameState';

export function passResponse(
  state: GameState,
  playerId: string
): GameState {
  if (state.turnPhase !== '等待响应') {
    throw new Error('当前不能选择过');
  }

  const pending = state.pendingResponses!;
  if (!pending.responders.includes(playerId)) {
    throw new Error('你不能回应这张牌');
  }

  const responses = {
    ...pending.responses,
    [playerId]: 'pass' as const,
  };

  const allDone = Object.values(responses).every(
    r => r !== 'pending'
  );

  if (!allDone) {
    return {
      ...state,
      pendingResponses: {
        ...pending,
        responses,
      },
    };
  }

  // 所有人都放弃 → 下家摸牌
  return {
    ...state,
    pendingResponses: undefined,
    turnPhase: '等待摸牌',
    currentPlayerIndex:
      (state.currentPlayerIndex + 1) % state.players.length,
  };
}
