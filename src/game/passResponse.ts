import type { GameState } from './gameState';
import { getWinningResponse, allResponsesDone, endResponsePhase } from './resolveResponse';
import { handleChi } from './handleChi';

export function passResponse(
  state: GameState,
  playerId: string
): GameState {
  if (state.turnPhase !== '等待响应') {
    throw new Error('当前不能选择过');
  }

  const pending = state.pendingResponses!;
  
  // 检查玩家是否有资格响应（胡、碰、杠、吃）
  const canRespond =
    pending.huResponders?.includes(playerId) ||
    pending.responders.includes(playerId) ||
    pending.gangResponders?.includes(playerId) ||
    pending.chiResponder === playerId;

  if (!canRespond) {
    throw new Error('你不能回应这张牌');
  }

  const responses = {
    ...pending.responses,
    [playerId]: 'pass' as const,
  };

  // 过水规则：如果该玩家有胡的资格但选择了过，记录这张牌
  let players = state.players;
  if (pending.huResponders?.includes(playerId)) {
    players = players.map(p => {
      if (p.id !== playerId) return p;
      const passedHuTiles = [...(p.passedHuTiles || [])];
      const tile = pending.tile;
      // 避免重复记录同一种牌
      if (!passedHuTiles.some(pt => pt.suit === tile.suit && pt.value === tile.value)) {
        passedHuTiles.push({ suit: tile.suit, value: tile.value });
      }
      return { ...p, passedHuTiles };
    });
  }

  const newState = {
    ...state,
    players,
    pendingResponses: {
      ...pending,
      responses,
    },
  };

  // 检查是否所有响应都已完成
  if (!allResponsesDone(newState)) {
    return newState;
  }

  // 检查是否有获胜的响应（chi）
  const winner = getWinningResponse(newState);
  if (winner && winner.action === 'chi' && pending.chiTileIds) {
    // 执行chi
    return handleChi(newState, winner.playerId, pending.chiTileIds, true);
  }

  // 所有人都放弃 → 下家摸牌
  return endResponsePhase(newState);
}
