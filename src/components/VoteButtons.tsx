import type { GameState } from '../game/gameState';

interface Props {
  game: GameState;
  playerId: string;
  sendAction: (action: string, payload?: Record<string, unknown>) => void;
}

export function VoteButtons({ game, playerId, sendAction }: Props) {
  if (game.roomPhase !== 'playing' && game.roomPhase !== 'settling' && game.roomPhase !== 'rolling_dice') {
    return null;
  }

  return (
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
          background: game.restartGameVotes?.includes(playerId) ? '#ff9900' : 'rgba(85,85,85,0.9)',
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
          background: game.restartCompetitionVotes?.includes(playerId) ? '#ff4444' : 'rgba(85,85,85,0.9)',
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
  );
}
