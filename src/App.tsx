import { useState, useRef, useEffect } from 'react'
import './App.css'
import { createInitialGameState } from './game/initGame';
import type { Tile } from './types/tile';
import type { GameState } from './game/gameState';
import Hand from './Hand';
import DiscardArea from './DiscardArea';

function App() {
  const ws = useRef<WebSocket | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);

  useEffect(() => {
    ws.current = new WebSocket('ws://localhost:8080');

    ws.current.onopen = () => {
      console.log('[Client] Connected to server');
    };

    ws.current.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'sync') {
        setGame(msg.game);
      } else if (msg.type === 'error') {
        alert(`Error: ${msg.message}`);
      }
    };

    ws.current.onerror = (err) => {
      console.error('[Client] WebSocket error:', err);
      alert('连接服务器失败，请检查服务器是否运行');
    };

    ws.current.onclose = () => {
      console.log('[Client] Disconnected from server');
    };

    return () => ws.current?.close();
  }, []);

  if (!game) {
    return <div style={{ padding: 20 }}>连接中...</div>;
  }

  const sendAction = (action: string, payload: any = {}) => {
    if (ws.current && ws.current.readyState === 1) {
      ws.current.send(JSON.stringify({ action, ...payload }));
    }
  };

  const currentPlayer = game.players[game.currentPlayerIndex];

  const handleSelectTile = (tile: Tile) => {
    setSelectedTileId(selectedTileId === tile.id ? null : tile.id);
  };

  const handleDrawTile = () => {
    sendAction('draw', { playerId: currentPlayer.id });
    setSelectedTileId(null);
  };

  const handleDiscardTile = () => {
    if (!selectedTileId) {
      alert('请先选择一张牌');
      return;
    }
    sendAction('discard', { playerId: currentPlayer.id, tileId: selectedTileId });
    setSelectedTileId(null);
  };

  const handlePengClick = () => {
    sendAction('peng', { playerId: currentPlayer.id });
  };

  const handlePassClick = () => {
    sendAction('pass', { playerId: currentPlayer.id });
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
