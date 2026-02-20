import type { RestoreInfo } from '../hooks/useGameConnection';

interface RestoreScreenProps {
  restoreInfo: RestoreInfo;
  playerId: string;
  sendAction: (action: string, payload?: Record<string, unknown>) => void;
}

export function RestoreScreen({ restoreInfo, playerId, sendAction }: RestoreScreenProps) {
  if (!restoreInfo.started) {
    // Phase 1: Ask if they want to restore
    return (
      <div style={{
        minWidth: 1400, minHeight: 900,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        background: '#1a1a1a', padding: 40,
      }}>
        <div style={{
          background: '#2e7d32', borderRadius: 16, padding: 60,
          boxShadow: '0 0 20px rgba(0,0,0,0.5)',
          textAlign: 'center', color: 'white', maxWidth: 500,
        }}>
          <h2 style={{ fontSize: 28, marginBottom: 16 }}>🀄 发现上次未完成的游戏</h2>
          <p style={{ fontSize: 16, marginBottom: 24, color: '#c8e6c9' }}>
            上次的游戏有 {restoreInfo.players.length} 位玩家：
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32, alignItems: 'center' }}>
            {restoreInfo.players.map(p => (
              <div key={p.id} style={{
                padding: '8px 24px', background: 'rgba(255,255,255,0.15)',
                borderRadius: 8, fontSize: 18,
              }}>
                {p.name}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <button
              onClick={() => sendAction('startRestore')}
              style={{
                padding: '12px 32px', fontSize: 18,
                background: '#4caf50', color: 'white',
                border: 'none', borderRadius: 8,
                cursor: 'pointer', fontWeight: 'bold',
              }}
            >
              恢复上次游戏
            </button>
            <button
              onClick={() => sendAction('cancelRestore')}
              style={{
                padding: '12px 32px', fontSize: 18,
                background: '#757575', color: 'white',
                border: 'none', borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              开始新游戏
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Phase 2: Pick who you are
  const myClaim = restoreInfo.claims[playerId]; // old player ID I've claimed

  // Build reverse: oldId -> newId (who claimed it)
  const claimedBy: Record<string, string> = {};
  for (const [newId, oldId] of Object.entries(restoreInfo.claims)) {
    claimedBy[oldId] = newId;
  }

  const totalClaimed = Object.keys(restoreInfo.claims).length;
  const totalPlayers = restoreInfo.players.length;

  return (
    <div style={{
      minWidth: 1400, minHeight: 900,
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      background: '#1a1a1a', padding: 40,
    }}>
      <div style={{
        background: '#2e7d32', borderRadius: 16, padding: 60,
        boxShadow: '0 0 20px rgba(0,0,0,0.5)',
        textAlign: 'center', color: 'white', maxWidth: 500,
      }}>
        <h2 style={{ fontSize: 28, marginBottom: 16 }}>🀄 选择你是哪位玩家</h2>
        <p style={{ fontSize: 14, marginBottom: 24, color: '#c8e6c9' }}>
          请选择你在上一局游戏中的身份
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', marginBottom: 24 }}>
          {restoreInfo.players.map(p => {
            const isMyClaim = myClaim === p.id;
            const isClaimedByOther = claimedBy[p.id] !== undefined && !isMyClaim;

            return (
              <button
                key={p.id}
                disabled={isClaimedByOther}
                onClick={() => sendAction('claimPlayer', { oldPlayerId: p.id })}
                style={{
                  padding: '12px 32px', fontSize: 18, width: 280,
                  background: isMyClaim ? '#4caf50' : isClaimedByOther ? '#555' : '#1976d2',
                  color: isClaimedByOther ? '#999' : 'white',
                  border: isMyClaim ? '3px solid #a5d6a7' : '3px solid transparent',
                  borderRadius: 8,
                  cursor: isClaimedByOther ? 'not-allowed' : 'pointer',
                  fontWeight: isMyClaim ? 'bold' : 'normal',
                  transition: 'all 0.2s',
                }}
              >
                {p.name}
                {isMyClaim && ' ✓'}
                {isClaimedByOther && ' (已被选择)'}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 14, color: '#a5d6a7', marginBottom: 24 }}>
          已选择: {totalClaimed} / {totalPlayers}
          {totalClaimed === totalPlayers && ' — 正在恢复游戏...'}
        </p>
        <button
          onClick={() => sendAction('cancelRestore')}
          style={{
            padding: '10px 24px', fontSize: 16,
            background: '#d32f2f', color: 'white',
            border: 'none', borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          取消恢复
        </button>
      </div>
    </div>
  );
}
