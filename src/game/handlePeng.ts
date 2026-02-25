import type { GameState } from './gameState';
import { isSameTile } from './tileUtils';

export function handlePeng(
  state: GameState,
  playerId: string
): GameState {
  if (state.turnPhase !== '等待响应') {
    throw new Error('当前不能碰');
  }

  const pending = state.pendingResponses;
  if (!pending || !pending.responders.includes(playerId)) {
    throw new Error('你不能碰这张牌');
  }

  const players = state.players.map(p => ({ ...p }));
  const playerIndex = players.findIndex(p => p.id === playerId);
  const player = players[playerIndex];

  // 从手牌移除两张
  const removed = player.hand.filter(
    t => isSameTile(t, state.lastDiscard!.tile)
  ).slice(0, 2);

  if (removed.length < 2) {
    throw new Error('手牌不足，无法碰');
  }

  player.hand = player.hand.filter(
    t => !removed.includes(t)
  );

  // 加入副露
  player.melds.push({
    type: 'peng',
    tiles: [pending.tile, ...removed],
    fromPlayerId: pending.fromPlayerId,
  });

  // 从打出者的弃牌区移除被碰的牌
  const fromPlayer = players.find(p => p.id === pending.fromPlayerId);
  if (fromPlayer) {
    const discardIdx = fromPlayer.discards.findIndex(t => t.id === pending.tile.id);
    if (discardIdx !== -1) {
      fromPlayer.discards.splice(discardIdx, 1);
    }
  }

  // 全球独钓限制：碰后如果4副露+手牌2张相同，不能荣和该牌
  const nonFlowerMelds = player.melds.filter(m => m.type !== 'flower');
  if (nonFlowerMelds.length === 4 && player.hand.length === 2) {
    const [t1, t2] = player.hand;
    if (t1.suit === t2.suit && t1.value === t2.value) {
      const passedHuTiles = [...(player.passedHuTiles || [])];
      if (!passedHuTiles.some(pt => pt.suit === t1.suit && pt.value === t1.value)) {
        passedHuTiles.push({ suit: t1.suit, value: t1.value });
      }
      player.passedHuTiles = passedHuTiles;
    }
  }

  return {
    ...state,
    players,
    currentPlayerIndex: playerIndex,
    turnPhase: '等待出牌',
    pendingResponses: undefined,
    lastDiscard: undefined,
    lastDrawnTileId: undefined,
    lastAction: { type: 'peng', playerId, actionId: `peng-${Date.now()}` },
  };
}
