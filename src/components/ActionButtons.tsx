import type { GameState } from '../game/gameState';
import type { Player } from '../types/player';
import { getChiOptions } from '../game/chi';
import { canAnGang, canJiaGang } from '../game/gang';
import { isChiLocked } from '../game/resolveResponse';
import { canZimo } from '../game/hu';

interface Props {
  game: GameState;
  me: Player;
  playerId: string;
  selectedTileId: string | null;
  nickname: string;
  onNicknameChange: (val: string) => void;
  sendAction: (action: string, payload?: Record<string, unknown>) => void;
  onDiscard: () => void;
  autopass: boolean;
  onAutopassChange: (val: boolean) => void;
}

export function ActionButtons({ game, me, playerId, selectedTileId, nickname, onNicknameChange, sendAction, onDiscard, autopass, onAutopassChange }: Props) {
  return (
    <div style={{
      position: 'absolute',
      right: 20,
      bottom: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      alignItems: 'flex-end',
    }}>
      {game.roomPhase === 'playing' && (
        <button
          onClick={() => onAutopassChange(!autopass)}
          style={{
            background: autopass ? '#ff9800' : '#555',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            padding: '4px 10px',
            cursor: 'pointer',
            fontSize: 13,
            opacity: 0.9,
          }}
        >
          {autopass ? '✅ 自动过牌' : '自动过牌'}
        </button>
      )}
      {game.roomPhase === 'waiting_ready' && (
        <div style={{ textAlign: 'right' }}>
          {!me.isReady && (
            <input
              placeholder="输入昵称"
              value={nickname}
              onChange={(e) => onNicknameChange(e.target.value)}
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
              <button onClick={onDiscard} disabled={!selectedTileId}>
                出牌
              </button>
              {canZimo(game, playerId) && (
                <button onClick={() => sendAction('zimo')} style={{ background: '#ff4444', color: 'white' }}>自摸</button>
              )}
              {canAnGang(game, playerId).map((tile) => (
                <button key={`angang-${tile.id}`} onClick={() => sendAction('angang', { tileId: tile.id })}>
                  暗杠 {tile.suit} {tile.value}
                </button>
              ))}
              {canJiaGang(game, playerId).map((tile) => (
                <button key={`jiagang-${tile.id}`} onClick={() => sendAction('jiagang', { tileId: tile.id })}>
                  加杠 {tile.suit} {tile.value}
                </button>
              ))}
            </>
          )}

          {game.turnPhase === '等待响应' && (
            <>
              {game.pendingResponses?.huResponders?.includes(playerId) && (
                <button onClick={() => sendAction('hu')} style={{ background: '#ff4444', color: 'white' }}>胡</button>
              )}
              {!autopass && game.pendingResponses?.responders.includes(playerId) && (
                <button onClick={() => sendAction('peng')}>碰</button>
              )}
              {!autopass && game.pendingResponses?.gangResponders?.includes(playerId) && (
                <button onClick={() => sendAction('gang')}>杠</button>
              )}
              {!autopass && game.pendingResponses?.chiResponder === playerId &&
                game.pendingResponses?.tile &&
                !isChiLocked(game) &&
                getChiOptions(me.hand, game.pendingResponses.tile).map((opt, idx) => (
                  <button key={idx} onClick={() => sendAction('chi', { tileIds: [opt.tiles[0].id, opt.tiles[1].id] })}>
                    吃 {opt.pattern}
                  </button>
                ))}
              {(game.pendingResponses?.huResponders?.includes(playerId) ||
                (!autopass && (game.pendingResponses?.responders.includes(playerId) ||
                game.pendingResponses?.gangResponders?.includes(playerId) ||
                game.pendingResponses?.chiResponder === playerId))) && (
                <button onClick={() => sendAction('pass')}>过</button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
