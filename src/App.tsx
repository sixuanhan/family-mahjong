import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import type { Tile } from './types/tile';
import Hand, { OtherPlayerHand } from './Hand';
import DiscardArea from './DiscardArea';
import { MeldArea } from './MeldArea';
import { useGameConnection } from './hooks/useGameConnection';
import { ConnectionStatus } from './components/ConnectionStatus';
import { HuManual } from './components/HuManual';
import { VoteButtons } from './components/VoteButtons';
import { CenterInfo } from './components/CenterInfo';
import { ActionButtons } from './components/ActionButtons';
import { RestoreScreen } from './components/RestoreScreen';
import { ThrowEmoji } from './components/ThrowEmoji';
import type { EmojiType } from './components/ThrowEmoji';
import { TileHoverProvider } from './hooks/useTileHover';
import { speakTileName, speakChinese } from './game/tileUtils';
import chiImg from './assets/chi.png';
import pengImg from './assets/peng.png';
import gangImg from './assets/gang.png';

function App() {
  const { game, playerId, connectionStatus, sendAction, restoreInfo, throwEmojiEvents, clearThrowEvent } = useGameConnection();
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [autopass, setAutopass] = useState(false);
  const [actionFlash, setActionFlash] = useState<string | null>(null);
  const actionFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDiscardRef = useRef<string | undefined>(undefined);
  const lastActionRef = useRef<string | undefined>(undefined);

  const actionImages: Record<string, string> = { chi: chiImg, peng: pengImg, gang: gangImg };

  const showActionFlash = useCallback((type: string) => {
    const img = actionImages[type];
    if (!img) return;
    if (actionFlashTimer.current) clearTimeout(actionFlashTimer.current);
    setActionFlash(img);
    actionFlashTimer.current = setTimeout(() => setActionFlash(null), 1800);
  }, []);

  // Speak tile name when a card is discarded
  useEffect(() => {
    if (!game?.lastDiscard) return;
    const discardId = game.lastDiscard.tile.id;
    if (discardId !== lastDiscardRef.current) {
      lastDiscardRef.current = discardId;
      speakTileName(game.lastDiscard.tile);
    }
  }, [game?.lastDiscard]);

  // Speak and flash action when chi/peng/gang/flower/hu/zimo occurs
  useEffect(() => {
    if (!game?.lastAction) return;
    if (game.lastAction.actionId === lastActionRef.current) return;
    lastActionRef.current = game.lastAction.actionId;

    const actionNames: Record<string, string> = {
      chi: '吃', peng: '碰', gang: '杠', angang: '杠', jiagang: '杠',
      flower: '花', hu: '胡', zimo: '自摸',
    };
    const name = actionNames[game.lastAction.type];
    if (name) speakChinese(name);

    // Flash image for chi/peng/gang actions
    const flashType = game.lastAction.type === 'angang' || game.lastAction.type === 'jiagang'
      ? 'gang' : game.lastAction.type;
    showActionFlash(flashType);
  }, [game?.lastAction]);

  // Reset autopass when a new game starts
  useEffect(() => {
    setAutopass(false);
  }, [game?.gameNumber]);

  // Autopass: automatically send 'pass' when in response phase, unless we can hu
  useEffect(() => {
    if (!autopass || !game || !playerId || game.turnPhase !== '等待响应' || !game.pendingResponses) return;
    const pending = game.pendingResponses;
    const canRespond =
      pending.huResponders?.includes(playerId) ||
      pending.responders.includes(playerId) ||
      pending.gangResponders?.includes(playerId) ||
      pending.chiResponder === playerId;
    if (!canRespond) return;
    // If we can hu, don't auto-pass — let the player decide
    if (pending.huResponders?.includes(playerId)) return;
    // Auto-pass chi/peng/gang
    sendAction('pass');
  }, [autopass, game, playerId, sendAction]);

  // Show restore screen if restore is available
  if (restoreInfo && playerId) {
    return <RestoreScreen restoreInfo={restoreInfo} playerId={playerId} sendAction={sendAction} />;
  }

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

  const handleSelectTile = (tile: Tile) => {
    setSelectedTileId(selectedTileId === tile.id ? null : tile.id);
  };

  const handleDiscardTile = () => {
    if (!selectedTileId) { alert('请先选择一张牌'); return; }
    sendAction('discard', { tileId: selectedTileId });
    setSelectedTileId(null);
  };

  const me = game.players.find((p) => p.id === playerId);
  if (!me || !playerId) {
    return <div style={{ padding: 20 }}>等待加入房间...</div>;
  }

  const meIndex = game.players.findIndex((p) => p.id === playerId);
  const total = game.players.length;

  const relativeOthers = game.players
    .map((p, idx) => ({ player: p, offset: (idx - meIndex + total) % total }))
    .filter((o) => o.offset !== 0)
    .sort((a, b) => a.offset - b.offset)
    .map((o) => o.player);

  const rightPlayer = total >= 3 ? relativeOthers[0] ?? null : null;
  const topPlayer = total === 4 ? relativeOthers[1] : total === 2 ? relativeOthers[0] : null;
  const leftPlayer = total === 4 ? relativeOthers[2] : total === 3 ? relativeOthers[1] : null;

  // Map incoming throw events to positions relative to the current player
  const positionForPlayer = (pid: string): 'top' | 'left' | 'right' | null => {
    if (topPlayer?.id === pid) return 'top';
    if (leftPlayer?.id === pid) return 'left';
    if (rightPlayer?.id === pid) return 'right';
    return null;
  };

  const incomingThrows = throwEmojiEvents
    .map(evt => {
      const pos = positionForPlayer(evt.toPlayerId);
      if (!pos) return null;
      return { id: evt.id, emoji: evt.emoji, targetPosition: pos as 'top' | 'left' | 'right' };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const handleThrowEmoji = useCallback((emoji: EmojiType, targetPlayerId: string) => {
    sendAction('throwEmoji', { toPlayerId: targetPlayerId, emoji });
  }, [sendAction]);

  const isWaitingResponse = game.turnPhase === '等待响应' && game.pendingResponses;
  const highlightedTileId = isWaitingResponse && game.pendingResponses?.tile
    ? game.pendingResponses.tile.id : undefined;
  const highlightedPlayerId = isWaitingResponse && game.pendingResponses?.fromPlayerId
    ? game.pendingResponses.fromPlayerId : undefined;

  const showFace = game.roomPhase === 'settling' || game.roomPhase === 'competition_end';

  const isMyTurnToDiscard = game.turnPhase === '等待出牌' && game.players[game.currentPlayerIndex]?.id === me.id;

  return (
    <TileHoverProvider>
    <div style={{ minWidth: 1400, minHeight: 900, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#1a1a1a', padding: '40px' }}>
      <ConnectionStatus status={connectionStatus} />
      <div data-game-board style={{ position: 'relative', width: 1400, height: 900, background: '#2e7d32', borderRadius: 16, boxShadow: '0 0 20px rgba(0,0,0,0.5)', flexShrink: 0, ...(isMyTurnToDiscard ? { animation: 'activePlayerGlow 4s ease-in-out infinite' } : {}) }}>

        <HuManual />
        <VoteButtons game={game} playerId={playerId} sendAction={sendAction} />

        {/* ===== 扔表情 ===== */}
        {game.roomPhase === 'playing' && (
          <ThrowEmoji
            onThrow={handleThrowEmoji}
            topPlayerId={topPlayer?.id ?? null}
            leftPlayerId={leftPlayer?.id ?? null}
            rightPlayerId={rightPlayer?.id ?? null}
            incomingThrows={incomingThrows}
            onThrowComplete={clearThrowEvent}
          />
        )}

        {/* ===== 动作闪图 ===== */}
        {actionFlash && (
          <img
            src={actionFlash}
            alt="action"
            style={{
              position: 'absolute',
              top: '45%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 200,
              height: 'auto',
              zIndex: 200,
              pointerEvents: 'none',
              animation: 'actionFlash 1.8s ease-out forwards',
            }}
          />
        )}

        {/* ===== 上方玩家 ===== */}
        <div style={{ position: 'absolute', top: 0, left: 200, width: 1000, height: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8, boxSizing: 'border-box' }}>
          {topPlayer && (
            <>
              <h4 style={{ textAlign: 'center', margin: '0 0 4px 0', fontSize: 14 }}>
                {game.players[game.zhuangIndex]?.id === topPlayer.id && '🀄 '}
                {topPlayer.name}
                {game.playerScores[topPlayer.id] !== undefined && ` (${game.playerScores[topPlayer.id]}分)`}
              </h4>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <MeldArea melds={topPlayer.melds} direction="top" />
                <OtherPlayerHand tileCount={topPlayer.hand.length} direction="top" tileWidth={32} tileHeight={44} tiles={topPlayer.hand} showFace={showFace} />
              </div>
            </>
          )}
        </div>

        {/* ===== 左侧玩家 ===== */}
        <div style={{ position: 'absolute', top: 120, left: 0, width: 200, height: 580, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8, boxSizing: 'border-box', gap: 8 }}>
          {leftPlayer && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 72 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>
                {game.players[game.zhuangIndex]?.id === leftPlayer.id && '🀄 '}
                {leftPlayer.name}
                {game.playerScores[leftPlayer.id] !== undefined && ` (${game.playerScores[leftPlayer.id]}分)`}
              </h4>
              <OtherPlayerHand tileCount={leftPlayer.hand.length} direction="left" tileWidth={32} tileHeight={44} tiles={leftPlayer.hand} showFace={showFace} />
              <MeldArea melds={leftPlayer.melds} direction="left" />
            </div>
          )}
        </div>

        {/* ===== 右侧玩家 ===== */}
        <div style={{ position: 'absolute', top: 120, right: 0, width: 200, height: 580, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8, boxSizing: 'border-box', gap: 8 }}>
          {rightPlayer && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 72 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>
                {game.players[game.zhuangIndex]?.id === rightPlayer.id && '🀄 '}
                {rightPlayer.name}
                {game.playerScores[rightPlayer.id] !== undefined && ` (${game.playerScores[rightPlayer.id]}分)`}
              </h4>
              <MeldArea melds={rightPlayer.melds} direction="right" />
              <OtherPlayerHand tileCount={rightPlayer.hand.length} direction="right" tileWidth={32} tileHeight={44} tiles={rightPlayer.hand} showFace={showFace} />
            </div>
          )}
        </div>

        {/* ===== 弃牌区 ===== */}
        <div style={{ position: 'absolute', top: 140, left: 210, width: 130, height: 520 }}>
          {leftPlayer && <DiscardArea tiles={leftPlayer.discards} direction="left" highlightedTileId={highlightedPlayerId === leftPlayer.id ? highlightedTileId : undefined} />}
        </div>
        <div style={{ position: 'absolute', top: 140, right: 210, width: 130, height: 520 }}>
          {rightPlayer && <DiscardArea tiles={rightPlayer.discards} direction="right" highlightedTileId={highlightedPlayerId === rightPlayer.id ? highlightedTileId : undefined} />}
        </div>
        <div style={{ position: 'absolute', top: 130, left: 400, width: 600, height: 80 }}>
          {topPlayer && <DiscardArea tiles={topPlayer.discards} direction="top" highlightedTileId={highlightedPlayerId === topPlayer.id ? highlightedTileId : undefined} />}
        </div>

        {/* ===== 中央信息区 ===== */}
        <CenterInfo game={game} playerId={playerId} sendAction={sendAction} />

        {/* ===== 底部（我）区域 ===== */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 1400, height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: 12, boxSizing: 'border-box', gap: 8 }}>
          {/* 我的信息 */}
          <div style={{ position: 'absolute', left: 20, bottom: 60, textAlign: 'left', color: 'white', fontSize: 14 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
              {game.players[game.zhuangIndex]?.id === me.id && '🀄 '}{me.name}
            </div>
            {game.playerScores[me.id] !== undefined && <div>分数：{game.playerScores[me.id]}</div>}
            {game.roomPhase === 'playing' && (
              <button
                onClick={() => setAutopass(!autopass)}
                style={{
                  background: autopass ? '#ff9800' : '#555',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: 13,
                  opacity: 0.9,
                  marginTop: 8,
                }}
              >
                {autopass ? '✅ 自动过牌' : '自动过牌'}
              </button>
            )}
          </div>

          {/* 我的弃牌 */}
          <div style={{ position: 'absolute', top: -60, left: 400, width: 600 }}>
            <DiscardArea tiles={me.discards} direction="bottom" highlightedTileId={highlightedPlayerId === me.id ? highlightedTileId : undefined} />
          </div>

          {/* 手牌+副露 */}
          <div style={{ width: 850, height: 110, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', position: 'relative' }}>
            <div>
              <Hand tiles={me.hand} onSelect={handleSelectTile} selectedTileId={selectedTileId} highlightedTileId={game.players[game.currentPlayerIndex].id === me.id ? game.lastDrawnTileId : undefined} />
            </div>
            {me.melds.length > 0 && (
              <div style={{ marginLeft: 16 }}><MeldArea melds={me.melds} direction="bottom" /></div>
            )}
          </div>

          {/* 操作按钮 */}
          <ActionButtons
            game={game}
            me={me}
            playerId={playerId}
            selectedTileId={selectedTileId}
            nickname={nickname}
            autopass={autopass}
            onNicknameChange={setNickname}
            sendAction={sendAction}
            onDiscard={handleDiscardTile}
          />
        </div>
      </div>
    </div>
    </TileHoverProvider>
  );
}

export default App
