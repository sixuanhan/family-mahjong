import { useState, useRef, useEffect } from 'react'
import './App.css'
import type { Tile } from './types/tile';
import type { GameState } from './game/gameState';
import Hand from './Hand';
import DiscardArea from './DiscardArea';

function App() {
  const ws = useRef<WebSocket | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    // 自动检测服务器地址：如果是本地访问用 localhost，否则用当前主机名/IP
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const wsUrl = `${protocol}//${host}:8080`;
    
    console.log(`[Client] Connecting to ${wsUrl}`);
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('[Client] Connected to server');
    };

    ws.current.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'welcome') {
        // 服务器告诉我：你是谁 + 当前房间状态
        setPlayerId(msg.playerId);
        setGame(msg.game);
        return;
      }

      if (msg.type === 'sync') {
        setGame(msg.game);
        return;
      }

      if (msg.type === 'error') {
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

  useEffect(() => {
    if (!ws.current) return;
    if (!playerId) return;
    if (ws.current.readyState !== WebSocket.OPEN) return;

    ws.current.send(
      JSON.stringify({
        action: 'join',
      })
    );
  }, [playerId]);

  if (!game) {
    return <div style={{ padding: 20 }}>连接中...</div>;
  }

  const sendAction = (action: string, payload: any = {}) => {
    if (ws.current && ws.current.readyState === 1) {
      ws.current.send(JSON.stringify({ action, ...payload }));
    }
  };

  const handleSelectTile = (tile: Tile) => {
    setSelectedTileId(selectedTileId === tile.id ? null : tile.id);
  };

  const handleDrawTile = () => {
    sendAction('draw');
    setSelectedTileId(null);
  };

  const handleDiscardTile = () => {
    if (!selectedTileId) {
      alert('请先选择一张牌');
      return;
    }
    sendAction('discard', { tileId: selectedTileId });
    setSelectedTileId(null);
  };

  const handlePengClick = () => {
    sendAction('peng');
  };

  const handlePassClick = () => {
    sendAction('pass');
  };

  const me = game.players.find((p) => p.id === playerId);
  if (!me) {
    return <div style={{ padding: 20 }}>等待加入房间...</div>;
  }

  const meIndex = game.players.findIndex((p) => p.id === playerId);
  const total = game.players.length;

  // 以“我”为基准，顺时针排序其他玩家
  const relativeOthers = game.players
    .map((p, idx) => ({ player: p, offset: (idx - meIndex + total) % total }))
    .filter((o) => o.offset !== 0)
    .sort((a, b) => a.offset - b.offset)
    .map((o) => o.player);

    const currentPlayer = game.players.find(
      (p) => p.id === game.players[game.currentPlayerIndex].id
    );

  const leftPlayer =
    total >= 2 ? relativeOthers[0] ?? null : null;

  const topPlayer =
    total === 4
      ? relativeOthers[1]
      : total === 2
      ? relativeOthers[0]
      : null;

  const rightPlayer =
    total === 4
      ? relativeOthers[2]
      : total === 3
      ? relativeOthers[1]
      : null;

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 16,
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 12,
        alignItems: 'center',
      }}
    >
      {/* ===== 上 ===== */}
      <div style={{ gridColumn: '2' }}>
        {topPlayer && (
          <>
            <h4 style={{ textAlign: 'center' }}>{topPlayer.name}</h4>
            <DiscardArea tiles={topPlayer.discards} />
          </>
        )}
      </div>

      {/* ===== 左 ===== */}
      <div style={{ gridRow: '2', gridColumn: '1' }}>
        {leftPlayer && (
          <>
            <h4>{leftPlayer.name}</h4>
            <DiscardArea tiles={leftPlayer.discards} />
          </>
        )}
      </div>

      {/* ===== 中央 ===== */}
      <div
        style={{
          gridRow: '2',
          gridColumn: '2',
          textAlign: 'center',
        }}
      >
        <p>牌山剩余：{game.wall.length}</p>
        <p>当前玩家：{currentPlayer?.name ?? '未知'}</p>
        <p>阶段：{game.turnPhase}</p>
      </div>

      {/* ===== 右 ===== */}
      <div style={{ gridRow: '2', gridColumn: '3' }}>
        {rightPlayer && (
          <>
            <h4>{rightPlayer.name}</h4>
            <DiscardArea tiles={rightPlayer.discards} />
          </>
        )}
      </div>

      {/* ===== 我（下） ===== */}
      <div
        style={{
          gridRow: '3',
          gridColumn: '1 / span 3',
          textAlign: 'center',
        }}
      >
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

        {/* ===== 准备按钮 ===== */}
        {game.roomPhase === 'waiting_ready' && (
          <div style={{ textAlign: 'center' }}>
            {!me.isReady && (
              <input
                placeholder="输入昵称（可选）"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                style={{ marginBottom: 8, padding: 4 }}
              />
            )}

            <br />

            <button
              onClick={() =>
                sendAction('ready', {
                  name: nickname.trim() || playerId,
                })
              }
            >
              {me.isReady ? '已准备' : '准备'}
            </button>
          </div>
        )}

        {/* ===== 操作按钮 ===== */}
        {game.roomPhase === 'playing' && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            {game.turnPhase === '等待摸牌' && (
              <button onClick={handleDrawTile}>摸牌</button>
            )}

            {game.turnPhase === '等待出牌' && (
              <button onClick={handleDiscardTile} disabled={!selectedTileId}>
                出牌
              </button>
            )}

            {game.turnPhase === '等待响应' && (
              <>
                <button onClick={handlePengClick}>碰</button>
                <button onClick={handlePassClick}>过</button>
              </>
            )}
          </div>
        )}
  </div>

    </div>
  );
}

export default App
