import { useState, useRef, useEffect } from 'react'
import './App.css'
import type { Tile } from './types/tile';
import type { GameState } from './game/gameState';
import Hand, { toRiichiId, getTileComponent, OtherPlayerHand } from './Hand';
import DiscardArea from './DiscardArea';
import { MeldArea } from './MeldArea';
import { TableTile } from './Tile3D';
import { getChiOptions } from './game/chi';
import { canAnGang, canJiaGang } from './game/gang';
import { canZimo } from './game/hu';

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

  const handleChiClick = (tileIds: [string, string]) => {
    sendAction('chi', { tileIds });
  };

  const handleGangClick = () => {
    sendAction('gang');
  };

  const handleAnGangClick = (tileId: string) => {
    sendAction('angang', { tileId });
  };

  const handleJiaGangClick = (tileId: string) => {
    sendAction('jiagang', { tileId });
  };

  const handleHuClick = () => {
    sendAction('hu');
  };

  const handleZimoClick = () => {
    sendAction('zimo');
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
    total >= 3 ? relativeOthers[0] ?? null : null;

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
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#1a1a1a',
        overflow: 'hidden',
      }}
    >
    <div
      style={{
        position: 'relative',
        width: 1400,
        height: 900,
        background: '#2e7d32',
        borderRadius: 16,
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.4)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* ===== 上方玩家区域 ===== */}
      <div style={{ 
        position: 'absolute',
        top: 0,
        left: 200,
        width: 1000,
        height: 120,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        boxSizing: 'border-box',
      }}>
        {topPlayer && (
          <>
            <h4 style={{ textAlign: 'center', margin: '0 0 4px 0', fontSize: 14 }}>{topPlayer.name}</h4>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {/* top玩家的右手边是我们的左边 */}
              <MeldArea melds={topPlayer.melds} direction="top" />
              <OtherPlayerHand tileCount={topPlayer.hand.length} direction="top" tileWidth={32} tileHeight={44} />
            </div>
          </>
        )}
      </div>

      {/* ===== 左侧玩家区域 ===== */}
      <div style={{ 
        position: 'absolute',
        top: 120,
        left: 0,
        width: 200,
        height: 580,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: 8,
        boxSizing: 'border-box',
        gap: 8,
      }}>
        {leftPlayer && (
          <>
            <h4 style={{ margin: 0, fontSize: 14 }}>{leftPlayer.name}</h4>
            {/* left玩家的右手边是我们的下方 */}
            <OtherPlayerHand tileCount={leftPlayer.hand.length} direction="left" tileWidth={32} tileHeight={44} />
            <MeldArea melds={leftPlayer.melds} direction="left" />
          </>
        )}
      </div>

      {/* ===== 左侧弃牌区 ===== */}
      <div style={{
        position: 'absolute',
        top: 140,
        left: 210,
        width: 130,
        height: 520,
      }}>
        {leftPlayer && <DiscardArea tiles={leftPlayer.discards} direction="left" />}
      </div>

      {/* ===== 右侧玩家区域 ===== */}
      <div style={{ 
        position: 'absolute',
        top: 120,
        right: 0,
        width: 200,
        height: 580,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: 8,
        boxSizing: 'border-box',
        gap: 8,
      }}>
        {rightPlayer && (
          <>
            <h4 style={{ margin: 0, fontSize: 14 }}>{rightPlayer.name}</h4>
            {/* right玩家的右手边是我们的上方 */}
            <MeldArea melds={rightPlayer.melds} direction="right" />
            <OtherPlayerHand tileCount={rightPlayer.hand.length} direction="right" tileWidth={32} tileHeight={44} />
          </>
        )}
      </div>

      {/* ===== 右侧弃牌区 ===== */}
      <div style={{
        position: 'absolute',
        top: 140,
        right: 210,
        width: 130,
        height: 520,
      }}>
        {rightPlayer && <DiscardArea tiles={rightPlayer.discards} direction="right" />}
      </div>

      {/* ===== 上方弃牌区 ===== */}
      <div style={{
        position: 'absolute',
        top: 130,
        left: 400,
        width: 600,
        height: 80,
      }}>
        {topPlayer && <DiscardArea tiles={topPlayer.discards} direction="top" />}
      </div>

      {/* ===== 中央信息区 ===== */}
      <div
        style={{
          position: 'absolute',
          top: 280,
          left: 400,
          width: 600,
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        {game.turnPhase === '游戏结束' && game.winner ? (
          <div style={{ 
            background: 'rgba(0,0,0,0.8)', 
            padding: 24, 
            borderRadius: 12,
            color: 'white'
          }}>
            <h2 style={{ color: '#ffcc00', marginBottom: 16 }}>
              🎉 游戏结束 🎉
            </h2>
            <p style={{ fontSize: 18, marginBottom: 8 }}>
              <strong>
                {game.players.find(p => p.id === game.winner!.playerId)?.name}
              </strong> 
              {game.winner.winType === 'zimo' ? ' 自摸胡牌！' : ' 荣和胡牌！'}
            </p>
            {game.winner.winType === 'ron' && game.winner.fromPlayerId && (
              <p>
                放炮：{game.players.find(p => p.id === game.winner!.fromPlayerId)?.name}
              </p>
            )}
          </div>
        ) : (
          <div>
            <p>牌山剩余：{game.wall.length}</p>
            <p>当前玩家：{currentPlayer?.name ?? '未知'}</p>
            <p>阶段：{game.turnPhase}</p>
          </div>
        )}
      </div>

      {/* ===== 底部（我）区域 ===== */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: 1400,
          height: 200,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: 12,
          boxSizing: 'border-box',
          gap: 8,
        }}
      >
        {/* ===== 我自己的弃牌 ===== */}
        <div style={{ position: 'absolute', top: 0, left: 400, width: 600 }}>
          <DiscardArea tiles={me.discards} direction="bottom" />
        </div>

        {/* ===== 手牌+副露区域（固定宽度850px） ===== */}
        <div style={{ 
          width: 850, 
          height: 110,
          display: 'flex', 
          alignItems: 'flex-end', 
          justifyContent: 'flex-start',
          position: 'relative',
        }}>
          {/* 手牌 */}
          <div>
            <Hand
              tiles={me.hand}
              onSelect={handleSelectTile}
              selectedTileId={selectedTileId}
            />
          </div>

          {/* 副露（右侧） */}
          {me.melds.length > 0 && (
            <div style={{ marginLeft: 16 }}>
              <MeldArea melds={me.melds} direction="bottom" />
            </div>
          )}
        </div>

        {/* ===== 操作按钮区域（固定在右侧） ===== */}
        <div style={{
          position: 'absolute',
          right: 20,
          bottom: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: 'flex-end',
        }}>
          {game.roomPhase === 'waiting_ready' && (
            <div style={{ textAlign: 'right' }}>
              {!me.isReady && (
                <input
                  placeholder="输入昵称"
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

          {game.roomPhase === 'playing' && (
            <>
              {game.turnPhase === '等待摸牌' && (
                <button onClick={handleDrawTile}>摸牌</button>
              )}

              {game.turnPhase === '等待出牌' && (
                <>
                  <button onClick={handleDiscardTile} disabled={!selectedTileId}>
                    出牌
                  </button>
                  {canZimo(game, playerId!) && (
                    <button onClick={handleZimoClick} style={{ background: '#ff4444', color: 'white' }}>自摸</button>
                  )}
                  {canAnGang(game, playerId!).map((tile) => (
                    <button key={`angang-${tile.id}`} onClick={() => handleAnGangClick(tile.id)}>
                      暗杠 {tile.suit} {tile.value}
                    </button>
                  ))}
                  {canJiaGang(game, playerId!).map((tile) => (
                    <button key={`jiagang-${tile.id}`} onClick={() => handleJiaGangClick(tile.id)}>
                      加杠 {tile.suit} {tile.value}
                    </button>
                  ))}
                </>
              )}

              {game.turnPhase === '等待响应' && (
                <>
                  {game.pendingResponses?.huResponders?.includes(playerId!) && (
                    <button onClick={handleHuClick} style={{ background: '#ff4444', color: 'white' }}>胡</button>
                  )}
                  {game.pendingResponses?.responders.includes(playerId!) && (
                    <button onClick={handlePengClick}>碰</button>
                  )}
                  {game.pendingResponses?.gangResponders?.includes(playerId!) && (
                    <button onClick={handleGangClick}>杠</button>
                  )}
                  {game.pendingResponses?.chiResponder === playerId &&
                    game.pendingResponses?.tile &&
                    getChiOptions(me.hand, game.pendingResponses.tile).map((opt, idx) => (
                      <button key={idx} onClick={() => handleChiClick([opt.tiles[0].id, opt.tiles[1].id])}>
                        吃 {opt.pattern}
                      </button>
                    ))}
                  {(game.pendingResponses?.huResponders?.includes(playerId!) ||
                    game.pendingResponses?.responders.includes(playerId!) ||
                    game.pendingResponses?.gangResponders?.includes(playerId!) ||
                    game.pendingResponses?.chiResponder === playerId) && (
                    <button onClick={handlePassClick}>过</button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

export default App
