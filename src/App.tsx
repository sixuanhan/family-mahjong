import { useState } from 'react'
import './App.css'
import { createInitialGameState } from './game/initGame';
import { discardTile } from './game/discard';
import { drawTile } from './game/draw';
import Hand from './Hand';
import { handlePeng } from './game/handlePeng';
import { passResponse } from './game/passResponse';
import type { Tile } from './types/tile';
import { runAIAutoTurns } from './game/runAIAutoTurns';
import DiscardArea from './DiscardArea';


function App() {
  const [game, setGame] = useState(
    createInitialGameState('room1', [
      { id: 'p1', name: '你', hand: [], melds: [], discards: [], isReady: true, isOnline: true },
      { id: 'p2', name: '爸', hand: [], melds: [], discards: [], isReady: true, isOnline: true },
      // { id: 'p3', name: '妈', hand: [], melds: [], discards: [], isReady: true, isOnline: true },
      // { id: 'p4', name: 'AI', hand: [], melds: [], discards: [], isReady: true, isOnline: true },
    ])
  );
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);

  const currentPlayer = game.players[game.currentPlayerIndex];

  const handleSelectTile = (tile: Tile) => {
    setSelectedTileId(selectedTileId === tile.id ? null : tile.id);
  };

  const handleDrawTile = () => {
    try {
      const next = drawTile(game, currentPlayer.id);
      setGame(next);
      setSelectedTileId(null);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleDiscardTile = () => {
    if (!selectedTileId) {
      alert('请先选择一张牌');
      return;
    }
    try {
      let next = discardTile(game, currentPlayer.id, selectedTileId);
      next = runAIAutoTurns(next);
      setGame(next);
      setSelectedTileId(null);
      console.log('我的弃牌', game.players[0].discards);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handlePengClick = () => {
    try {
      const next = handlePeng(game, currentPlayer.id);
      setGame(next);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handlePassClick = () => {
    try {
      const next = passResponse(game, currentPlayer.id);
      setGame(next);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const me = currentPlayer;

  const others = game.players.filter(
    (_, idx) => idx !== game.currentPlayerIndex
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* ===== 上方玩家（如果存在） ===== */}
      {others[2] && (
        <div style={{ textAlign: 'center' }}>
          <h4>{others[2].name}</h4>
          <DiscardArea tiles={others[2].discards} />
        </div>
      )}

      {/* ===== 中间一排：左 / 中 / 右 ===== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            others.length === 3
              ? '1fr 1fr 1fr'
              : others.length === 2
              ? '1fr 1fr'
              : '1fr',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* 左 */}
        {others[0] && (
          <div>
            <h4>{others[0].name}</h4>
            <DiscardArea tiles={others[0].discards} />
          </div>
        )}

        {/* 中央信息 */}
        <div style={{ textAlign: 'center' }}>
          <p>牌山剩余：{game.wall.length}</p>
          <p>当前玩家：{me.name}</p>
          <p>阶段：{game.turnPhase}</p>
        </div>

        {/* 右 */}
        {others[1] && others.length === 3 && (
          <div>
            <h4>{others[1].name}</h4>
            <DiscardArea tiles={others[1].discards} />
          </div>
        )}
      </div>

      {/* ===== 我自己的弃牌 ===== */}
      <div>
        <h4 style={{ textAlign: 'center' }}>你的弃牌</h4>
        <DiscardArea tiles={me.discards} />
      </div>

      {/* ===== 手牌 ===== */}
      <Hand
        tiles={me.hand}
        onSelect={handleSelectTile}
        selectedTileId={selectedTileId}
      />

      {/* ===== 操作按钮 ===== */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        {game.turnPhase === 'waiting_draw' && (
          <button onClick={handleDrawTile}>摸牌</button>
        )}

        {game.turnPhase === 'waiting_discard' && (
          <button onClick={handleDiscardTile} disabled={!selectedTileId}>
            出牌
          </button>
        )}

        {game.turnPhase === 'waiting_response' && (
          <>
            <button onClick={handlePengClick}>碰</button>
            <button onClick={handlePassClick}>过</button>
          </>
        )}
      </div>
    </div>
  );
}

export default App
