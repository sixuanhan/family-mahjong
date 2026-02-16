import { useState, useRef, useEffect } from 'react'
import './App.css'
import type { Tile } from './types/tile';
import type { GameState } from './game/gameState';
import Hand, { OtherPlayerHand } from './Hand';
import DiscardArea from './DiscardArea';
import { MeldArea } from './MeldArea';
import { getChiOptions } from './game/chi';
import { canAnGang, canJiaGang } from './game/gang';
import { isChiLocked } from './game/resolveResponse';
import { canZimo } from './game/hu';

function App() {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 20;
  const isUnmounting = useRef(false);
  const [game, setGame] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [showHuManual, setShowHuManual] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting');

  const connectWebSocket = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    isUnmounting.current = false;

    connectWebSocket.current = () => {
      // 1. Check if we are running on our own computer
      const isLocal = window.location.hostname === 'localhost';

      // 2. PASTE THE URL FROM TERMINAL C HERE (No https://, no / at the end)
      const tunnelUrl = 'eternal-exhibits-incurred-partially.trycloudflare.com';

      // 3. Select the host based on where we are
      const backendHost = isLocal ? 'localhost:3000' : tunnelUrl;
      
      // 4. Select wss (secure) for the tunnel, ws for local
      const protocol = isLocal ? 'ws:' : 'wss:';

      // ... existing code ...
      const storedPlayerId = localStorage.getItem('mahjong-playerId');
      const reconnectParam = storedPlayerId ? `?reconnectId=${storedPlayerId}` : '';
      
      // 5. Construct the final URL
      const wsUrl = `${protocol}//${backendHost}/ws${reconnectParam}`;

      console.log(`[Client] Connecting to ${wsUrl} (attempt ${reconnectAttempts.current + 1})`);
      setConnectionStatus(reconnectAttempts.current === 0 ? 'connecting' : 'reconnecting');

      const socket = new WebSocket(wsUrl);
      ws.current = socket;

      socket.onopen = () => {
        console.log('[Client] Connected to server');
        reconnectAttempts.current = 0;
        setConnectionStatus('connected');
      };

      socket.onmessage = (e) => {
        const msg = JSON.parse(e.data);

        if (msg.type === 'welcome') {
          setPlayerId(msg.playerId);
          localStorage.setItem('mahjong-playerId', msg.playerId);
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

      socket.onerror = (err) => {
        console.error('[Client] WebSocket error:', err);
      };

      socket.onclose = () => {
        console.log('[Client] Disconnected from server');
        if (isUnmounting.current) return;

        if (reconnectAttempts.current < maxReconnectAttempts) {
          setConnectionStatus('reconnecting');
          // Exponential backoff: 1s, 2s, 4s, 8s, capped at 10s
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          console.log(`[Client] Reconnecting in ${delay}ms...`);
          reconnectTimer.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket.current?.();
          }, delay);
        } else {
          setConnectionStatus('disconnected');
        }
      };
    };

    connectWebSocket.current();

    return () => {
      isUnmounting.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
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

  // 倒计时更新
  useEffect(() => {
    if (!game || game.turnPhase !== '等待响应' || !game.pendingResponses) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const deadline = game.pendingResponses?.responseDeadline;
      if (deadline) {
        const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        setCountdown(remaining);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 500);
    return () => clearInterval(interval);
  }, [game?.turnPhase, game?.pendingResponses?.responseDeadline]);

  if (!game) {
    return (
      <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        {connectionStatus === 'disconnected' ? (
          <>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#f44336' }} />
            连接已断开，请刷新页面重试
          </>
        ) : (
          <>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ff9800', animation: 'pulse 1.5s infinite' }} />
            连接中...
          </>
        )}
      </div>
    );
  }

  const sendAction = (action: string, payload: any = {}) => {
    console.log('[Client] sendAction:', action, payload);
    if (ws.current && ws.current.readyState === 1) {
      ws.current.send(JSON.stringify({ action, ...payload }));
    } else {
      console.warn('[Client] WebSocket not ready, action not sent');
    }
  };

  const handleSelectTile = (tile: Tile) => {
    setSelectedTileId(selectedTileId === tile.id ? null : tile.id);
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

  // 等待响应时高亮显示刚打出的牌（所有人都能看到）
  const isWaitingResponse = game.turnPhase === '等待响应' && game.pendingResponses;
  // 总是高亮最后打出的牌
  const highlightedTileId = isWaitingResponse && game.pendingResponses?.tile
    ? game.pendingResponses.tile.id
    : undefined;
  const highlightedPlayerId = isWaitingResponse && game.pendingResponses?.fromPlayerId
    ? game.pendingResponses.fromPlayerId
    : undefined;

  return (
    <div
      style={{
        minWidth: 1400, 
      minHeight: 900,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#1a1a1a',
      padding: '40px',
      }}
    >
    {/* Connection status indicator */}
    {connectionStatus !== 'connected' && (
      <div style={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderRadius: 20,
        background: connectionStatus === 'disconnected' ? 'rgba(244,67,54,0.9)' : 'rgba(255,152,0,0.9)',
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(4px)',
      }}>
        <span style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: 'white',
          animation: connectionStatus === 'reconnecting' ? 'pulse 1.5s infinite' : 'none',
        }} />
        {connectionStatus === 'reconnecting' ? '重新连接中...' : '连接已断开'}
      </div>
    )}
    <div
      style={{
        position: 'relative',
        width: 1400,
        height: 900,
        background: '#2e7d32',
        borderRadius: 16,
        boxShadow: '0 0 20px rgba(0,0,0,0.5)',
        flexShrink: 0,
      }}
    >
      {/* ===== 胡牌说明手册 ===== */}
      <div style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 100,
        background: 'rgba(0,0,0,0.85)',
        borderRadius: 8,
        color: 'white',
        fontSize: 13,
        maxWidth: showHuManual ? 280 : 'auto',
      }}>
        <button
          onClick={() => setShowHuManual(!showHuManual)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#ffcc00',
            cursor: 'pointer',
            padding: '8px 12px',
            fontSize: 13,
            width: '100%',
            textAlign: 'left',
          }}
        >
          {showHuManual ? '▼ 胡牌说明' : '▶ 胡牌说明'}
        </button>
        {showHuManual && (
          <div style={{ padding: '0 12px 12px 12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #555' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0' }}>番型</th>
                  <th style={{ textAlign: 'right', padding: '4px 0' }}>分数</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>平胡</td><td style={{ textAlign: 'right' }}>10</td></tr>
                <tr style={{ color: '#aaa', fontSize: 11 }}><td colSpan={2}>└ 需门前清</td></tr>
                <tr><td>对对胡</td><td style={{ textAlign: 'right' }}>30</td></tr>
                <tr><td>混一色</td><td style={{ textAlign: 'right' }}>30</td></tr>
                <tr><td>七对</td><td style={{ textAlign: 'right' }}>50</td></tr>
                <tr><td>清一色</td><td style={{ textAlign: 'right' }}>50</td></tr>
                <tr><td>全球独钓</td><td style={{ textAlign: 'right' }}>50</td></tr>
                <tr><td>全幺九</td><td style={{ textAlign: 'right' }}>100</td></tr>
                <tr><td>小三元</td><td style={{ textAlign: 'right' }}>100</td></tr>
                <tr style={{ color: '#aaa', fontSize: 11 }}><td colSpan={2}>└ 332</td></tr>
                <tr><td>字一色</td><td style={{ textAlign: 'right' }}>100</td></tr>
                <tr><td>大三元</td><td style={{ textAlign: 'right' }}>200</td></tr>
                <tr><td>小四喜</td><td style={{ textAlign: 'right' }}>200</td></tr>
                <tr style={{ color: '#aaa', fontSize: 11 }}><td colSpan={2}>└ 332</td></tr>
                <tr><td>大四喜</td><td style={{ textAlign: 'right' }}>300</td></tr>
                <tr><td>风碰</td><td style={{ textAlign: 'right' }}>300</td></tr>
                <tr style={{ color: '#aaa', fontSize: 11 }}><td colSpan={2}>└ 需一句话</td></tr>
                <tr><td>十三幺</td><td style={{ textAlign: 'right' }}>1000</td></tr>
                <tr style={{ color: '#aaa', fontSize: 11 }}><td colSpan={2}>└ 其中一种需2张</td></tr>
              </tbody>
            </table>
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #555', fontSize: 11, color: '#aaa' }}>
              <p style={{ margin: '4px 0' }}>● 花牌：每朵 +1 分</p>
              <p style={{ margin: '4px 0' }}>● 多番型可叠加计分</p>
              <p style={{ margin: '4px 0' }}>● 杠上开花翻倍（连续杠×2×2...）</p>
            </div>
          </div>
        )}
      </div>

      {/* ===== 重开投票按钮（右上角） ===== */}
      {(game.roomPhase === 'playing' || game.roomPhase === 'settling' || game.roomPhase === 'rolling_dice') && (
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'flex-end',
        }}>
          <button 
            onClick={() => sendAction('voteRestartGame')}
            style={{ 
              padding: '4px 12px', 
              fontSize: 12,
              background: game.restartGameVotes?.includes(playerId!) ? '#ff9900' : 'rgba(85,85,85,0.9)',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            重开本局 {game.restartGameVotes?.length || 0}/{game.players.length}
          </button>
          <button 
            onClick={() => sendAction('voteRestartCompetition')}
            style={{ 
              padding: '4px 12px', 
              fontSize: 12,
              background: game.restartCompetitionVotes?.includes(playerId!) ? '#ff4444' : 'rgba(85,85,85,0.9)',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            重开比赛 {game.restartCompetitionVotes?.length || 0}/{game.players.length}
          </button>
          {(game.restartGameVotes?.length || game.restartCompetitionVotes?.length) ? (
            <div style={{ fontSize: 10, color: '#ddd', textAlign: 'right', background: 'rgba(0,0,0,0.7)', padding: 4, borderRadius: 4 }}>
              {game.restartGameVotes?.length ? (
                <div>
                  重开本局: {game.restartGameVotes.map(id => 
                    game.players.find(p => p.id === id)?.name
                  ).join(', ')}
                </div>
              ) : null}
              {game.restartCompetitionVotes?.length ? (
                <div>
                  重开比赛: {game.restartCompetitionVotes.map(id => 
                    game.players.find(p => p.id === id)?.name
                  ).join(', ')}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

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
            <h4 style={{ textAlign: 'center', margin: '0 0 4px 0', fontSize: 14 }}>
              {game.players[game.zhuangIndex]?.id === topPlayer.id && '🀄 '}
              {topPlayer.name}
              {game.playerScores[topPlayer.id] !== undefined && ` (${game.playerScores[topPlayer.id]}分)`}
            </h4>
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
        justifyContent: 'center',
        padding: 8,
        boxSizing: 'border-box',
        gap: 8,
      }}>
        {leftPlayer && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 72 }}>
            <h4 style={{ margin: 0, fontSize: 14 }}>
              {game.players[game.zhuangIndex]?.id === leftPlayer.id && '🀄 '}
              {leftPlayer.name}
              {game.playerScores[leftPlayer.id] !== undefined && ` (${game.playerScores[leftPlayer.id]}分)`}
            </h4>
            {/* left玩家的右手边是我们的下方 */}
            <OtherPlayerHand tileCount={leftPlayer.hand.length} direction="left" tileWidth={32} tileHeight={44} />
            <MeldArea melds={leftPlayer.melds} direction="left" />
          </div>
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
        {leftPlayer && <DiscardArea tiles={leftPlayer.discards} direction="left" highlightedTileId={highlightedPlayerId === leftPlayer.id ? highlightedTileId : undefined} />}
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
        justifyContent: 'center',
        padding: 8,
        boxSizing: 'border-box',
        gap: 8,
      }}>
        {rightPlayer && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 72 }}>
            <h4 style={{ margin: 0, fontSize: 14 }}>
              {game.players[game.zhuangIndex]?.id === rightPlayer.id && '🀄 '}
              {rightPlayer.name}
              {game.playerScores[rightPlayer.id] !== undefined && ` (${game.playerScores[rightPlayer.id]}分)`}
            </h4>
            {/* right玩家的右手边是我们的上方 */}
            <MeldArea melds={rightPlayer.melds} direction="right" />
            <OtherPlayerHand tileCount={rightPlayer.hand.length} direction="right" tileWidth={32} tileHeight={44} />
          </div>
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
        {rightPlayer && <DiscardArea tiles={rightPlayer.discards} direction="right" highlightedTileId={highlightedPlayerId === rightPlayer.id ? highlightedTileId : undefined} />}
      </div>

      {/* ===== 上方弃牌区 ===== */}
      <div style={{
        position: 'absolute',
        top: 130,
        left: 400,
        width: 600,
        height: 80,
      }}>
        {topPlayer && <DiscardArea tiles={topPlayer.discards} direction="top" highlightedTileId={highlightedPlayerId === topPlayer.id ? highlightedTileId : undefined} />}
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
        {/* 掷骰子阶段 */}
        {game.roomPhase === 'rolling_dice' && (
          <div style={{ 
            background: 'rgba(0,0,0,0.8)', 
            padding: 24, 
            borderRadius: 12,
            color: 'white',
            minWidth: 300,
          }}>
            <h2 style={{ color: '#ffcc00', marginBottom: 16 }}>🎲 掷骰子定庄 🎲</h2>
            <p style={{ marginBottom: 16 }}>第 {game.gameNumber} 局</p>
            {/* 显示是否是重掷 */}
            {game.diceRollEligible && game.diceRollEligible.length < game.players.length && (
              <p style={{ color: '#ff9900', marginBottom: 12 }}>
                ⚡ 平局！{game.diceRollEligible.map(id => 
                  game.players.find(p => p.id === id)?.name
                ).join('、')} 需要重掷
              </p>
            )}
            <div style={{ marginBottom: 16 }}>
              {game.players.map(p => {
                const eligible = game.diceRollEligible || game.players.map(pl => pl.id);
                const isEligible = eligible.includes(p.id);
                // 获取本轮的掷骰结果
                const allRolls = game.diceRolls || [];
                const thisRoundRolls = allRolls.filter(r => eligible.includes(r.playerId));
                const roll = thisRoundRolls.find(r => r.playerId === p.id);
                // 获取之前轮次的掷骰结果（用于显示历史）
                const previousRoll = !isEligible ? allRolls.find(r => r.playerId === p.id) : null;
                
                return (
                  <div key={p.id} style={{ 
                    padding: 4,
                    opacity: isEligible ? 1 : 0.5,
                  }}>
                    <strong>{p.name}</strong>: {
                      roll 
                        ? `🎲 ${roll.dice[0]} + ${roll.dice[1]} = ${roll.total}` 
                        : isEligible 
                          ? '等待掷骰子...'
                          : previousRoll
                            ? `🎲 ${previousRoll.total} (已淘汰)`
                            : '等待中...'}
                  </div>
                );
              })}
            </div>
            {(() => {
              const eligible = game.diceRollEligible || game.players.map(p => p.id);
              const isEligible = eligible.includes(playerId!);
              const thisRoundRolls = (game.diceRolls || []).filter(r => eligible.includes(r.playerId));
              const hasRolled = thisRoundRolls.some(r => r.playerId === playerId);
              
              return isEligible && !hasRolled && (
                <button 
                  onClick={() => sendAction('rollDice')}
                  style={{ padding: '8px 24px', fontSize: 16 }}
                >
                  🎲 掷骰子
                </button>
              );
            })()}
          </div>
        )}

        {/* 比赛结束 */}
        {game.roomPhase === 'competition_end' && game.competitionWinner && (
          <div style={{ 
            background: 'rgba(0,0,0,0.9)', 
            padding: 32, 
            borderRadius: 12,
            color: 'white'
          }}>
            <h2 style={{ color: '#ffcc00', marginBottom: 16 }}>🏆 比赛结束 🏆</h2>
            <p style={{ fontSize: 20, marginBottom: 16 }}>
              冠军：<strong style={{ color: '#ffcc00' }}>
                {game.players.find(p => p.id === game.competitionWinner)?.name}
              </strong>
            </p>
            <div style={{ marginTop: 16 }}>
              <p>最终得分：</p>
              {game.players.map(p => (
                <div key={p.id} style={{ padding: 4 }}>
                  {p.name}: {game.playerScores[p.id]} 分
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 结算阶段 - 荒庄 */}
        {game.roomPhase === 'settling' && game.isHuangzhuang && (
          <div style={{ 
            background: 'rgba(0,0,0,0.8)', 
            padding: 24, 
            borderRadius: 12,
            color: 'white',
            minWidth: 350,
          }}>
            <h2 style={{ color: '#888', marginBottom: 12 }}>
              🀫 第 {game.gameNumber} 局 - 荒庄 🀫
            </h2>
            <p style={{ fontSize: 16, marginBottom: 16 }}>
              牌山已尽，无人胡牌
            </p>
            <div style={{ 
              background: '#333', 
              padding: 12, 
              borderRadius: 8,
              marginBottom: 12
            }}>
              <p style={{ color: '#ffcc00', marginBottom: 4 }}>
                连续荒庄：{game.huangzhuangCount} 次
              </p>
              <p style={{ fontSize: 14, color: '#aaa' }}>
                下一局分数翻倍 ×{Math.pow(2, game.huangzhuangCount)}
              </p>
            </div>
            <p style={{ marginBottom: 8, color: '#aaa' }}>庄家不变</p>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #555' }}>
              <p>当前分数：</p>
              {game.players.map(p => (
                <span key={p.id} style={{ marginRight: 12 }}>
                  {p.name}: {game.playerScores[p.id]}
                </span>
              ))}
            </div>
            <button 
              onClick={() => sendAction('nextGame')}
              style={{ marginTop: 16, padding: '8px 24px', fontSize: 16 }}
            >
              下一局
            </button>
          </div>
        )}

        {/* 结算阶段 - 有人胡牌 */}
        {game.roomPhase === 'settling' && game.winner && (
          <div style={{ 
            background: 'rgba(0,0,0,0.8)', 
            padding: 24, 
            borderRadius: 12,
            color: 'white',
            minWidth: 350,
          }}>
            <h2 style={{ color: '#ffcc00', marginBottom: 12 }}>
              🎉 第 {game.gameNumber} 局结束 🎉
            </h2>
            <p style={{ fontSize: 16, marginBottom: 8 }}>
              <strong>{game.players.find(p => p.id === game.winner!.playerId)?.name}</strong>
              {game.winner.winType === 'zimo' ? ' 自摸胡牌！' : ' 荣和胡牌！'}
            </p>
            {game.winner.patterns && (
              <div style={{ marginBottom: 12 }}>
                {game.winner.patterns.map((p, idx) => (
                  <span key={idx} style={{ 
                    background: '#444', 
                    padding: '2px 6px', 
                    borderRadius: 4,
                    fontSize: 12,
                    marginRight: 4
                  }}>
                    {p.name}
                  </span>
                ))}
              </div>
            )}
            <div style={{ borderTop: '1px solid #555', paddingTop: 12, marginTop: 8 }}>
              <p style={{ marginBottom: 8 }}>分数变化：</p>
              {game.scoreChanges?.map((sc, idx) => (
                <div key={idx} style={{ 
                  padding: 2, 
                  color: sc.change > 0 ? '#4caf50' : '#f44336' 
                }}>
                  {game.players.find(p => p.id === sc.playerId)?.name}: 
                  {sc.change > 0 ? '+' : ''}{sc.change} ({sc.reason})
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #555' }}>
              <p>当前分数：</p>
              {game.players.map(p => (
                <span key={p.id} style={{ marginRight: 12 }}>
                  {p.name}: {game.playerScores[p.id]}
                </span>
              ))}
            </div>
            <button 
              onClick={() => sendAction('nextGame')}
              style={{ marginTop: 16, padding: '8px 24px', fontSize: 16 }}
            >
              下一局
            </button>
          </div>
        )}

        {/* 游戏进行中 */}
        {game.roomPhase === 'playing' && game.turnPhase !== '游戏结束' && (
          <div>
            <p>第 {game.gameNumber} 局 | 牌山剩余：{game.wall.length}</p>
            <p>庄家：{game.players[game.zhuangIndex]?.name} | 当前：{currentPlayer?.name ?? '未知'}</p>
            <p>阶段：{game.turnPhase}</p>
            {game.huangzhuangCount > 0 && (
              <p style={{ color: '#ffcc00' }}>
                荒庄翻倍 ×{Math.pow(2, game.huangzhuangCount)}
              </p>
            )}
          </div>
        )}

        {/* 等待响应倒计时 - 只对能响应的玩家显示 */}
        {isWaitingResponse && countdown !== null && countdown <= 15 && playerId && (
          game.pendingResponses?.huResponders?.includes(playerId) ||
          game.pendingResponses?.responders.includes(playerId) ||
          game.pendingResponses?.gangResponders?.includes(playerId) ||
          game.pendingResponses?.chiResponder === playerId
        ) && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100,
            pointerEvents: 'none',
          }}>
            <div style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: countdown <= 3 ? 'rgba(255, 68, 68, 0.9)' : 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: countdown <= 3 
                ? '0 0 30px rgba(255, 68, 68, 0.8)' 
                : '0 0 20px rgba(0, 0, 0, 0.5)',
              border: '3px solid',
              borderColor: countdown <= 3 ? '#ff4444' : '#ffcc00',
              animation: countdown <= 3 ? 'pulse 0.5s infinite' : 'none',
            }}>
              <span style={{
                color: 'white',
                fontSize: 48,
                fontWeight: 'bold',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              }}>
                {countdown}
              </span>
            </div>
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
        {/* ===== 我的信息（左侧） ===== */}
        <div style={{ 
          position: 'absolute', 
          left: 20, 
          bottom: 60, 
          textAlign: 'left',
          color: 'white',
          fontSize: 14,
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
            {game.players[game.zhuangIndex]?.id === me.id && '🀄 '}
            {me.name}
          </div>
          {game.playerScores[me.id] !== undefined && (
            <div>分数：{game.playerScores[me.id]}</div>
          )}
        </div>

        {/* ===== 我自己的弃牌 ===== */}
        <div style={{ position: 'absolute', top: 0, left: 400, width: 600 }}>
          <DiscardArea tiles={me.discards} direction="bottom" highlightedTileId={highlightedPlayerId === me.id ? highlightedTileId : undefined} />
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
              highlightedTileId={game.players[game.currentPlayerIndex].id === me.id ? game.lastDrawnTileId : undefined}
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
              {game.turnPhase === '等待出牌' && game.players[game.currentPlayerIndex].id === me.id && (
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
                    !isChiLocked(game) &&
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
