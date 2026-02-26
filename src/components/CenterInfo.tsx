import { useState, useEffect } from 'react';
import type { GameState } from '../game/gameState';

interface Props {
  game: GameState;
  playerId: string;
  sendAction: (action: string, payload?: Record<string, unknown>) => void;
}

export function CenterInfo({ game, playerId, sendAction }: Props) {
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (game.turnPhase !== '等待响应' || !game.pendingResponses) {
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
  }, [game.turnPhase, game.pendingResponses?.responseDeadline]);

  const currentPlayer = game.players[game.currentPlayerIndex];
  const isWaitingResponse = game.turnPhase === '等待响应' && game.pendingResponses;

  const canRespondToCountdown = isWaitingResponse && countdown !== null && countdown <= 15 && (
    game.pendingResponses?.huResponders?.includes(playerId) ||
    game.pendingResponses?.responders.includes(playerId) ||
    game.pendingResponses?.gangResponders?.includes(playerId) ||
    game.pendingResponses?.chiResponder === playerId
  );

  return (
    <div style={{
      position: 'absolute',
      top: 280,
      left: 400,
      width: 600,
      height: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
    }}>
      {/* 掷骰子阶段 */}
      {game.roomPhase === 'rolling_dice' && (
        <DiceRoll game={game} playerId={playerId} sendAction={sendAction} />
      )}

      {/* 比赛结束 */}
      {game.roomPhase === 'competition_end' && game.competitionWinner && (
        <CompetitionEnd game={game} playerId={playerId} sendAction={sendAction} />
      )}

      {/* 结算阶段 - 荒庄 */}
      {game.roomPhase === 'settling' && game.isHuangzhuang && (
        <HuangzhuangSettlement game={game} playerId={playerId} sendAction={sendAction} />
      )}

      {/* 结算阶段 - 有人胡牌 */}
      {game.roomPhase === 'settling' && game.winner && (
        <WinnerSettlement game={game} playerId={playerId} sendAction={sendAction} />
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

      {/* 等待响应倒计时 */}
      {canRespondToCountdown && countdown !== null && (
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
  );
}

function DiceRoll({ game, playerId, sendAction }: Props) {
  const eligible = game.diceRollEligible || game.players.map(p => p.id);
  const currentRound = game.diceRound || 1;
  const allRolls = game.diceRolls || [];
  const thisRoundRolls = allRolls.filter(r => r.round === currentRound && eligible.includes(r.playerId));
  const isEligible = eligible.includes(playerId);
  const hasRolled = thisRoundRolls.some(r => r.playerId === playerId);
  const isTieReroll = eligible.length < game.players.length;

  return (
    <div style={{
      background: 'rgba(0,0,0,0.8)',
      padding: 24,
      borderRadius: 12,
      color: 'white',
      minWidth: 300,
    }}>
      <h2 style={{ color: '#ffcc00', marginBottom: 16 }}>🎲 掷骰子定庄 🎲</h2>
      <p style={{ marginBottom: 16 }}>第 {game.gameNumber} 局</p>
      {isTieReroll && (
        <p style={{ color: '#ff9900', marginBottom: 12 }}>
          ⚡ 平局！{eligible.map(id =>
            game.players.find(p => p.id === id)?.name
          ).join('、')} 需要重掷（第 {currentRound} 轮）
        </p>
      )}
      <div style={{ marginBottom: 16 }}>
        {game.players.map(p => {
          const pEligible = eligible.includes(p.id);
          const roll = thisRoundRolls.find(r => r.playerId === p.id);
          // For eliminated players, show their best roll from previous rounds
          const previousRoll = !pEligible
            ? allRolls.filter(r => r.playerId === p.id).sort((a, b) => b.total - a.total)[0]
            : null;

          return (
            <div key={p.id} style={{
              padding: 4,
              opacity: pEligible ? 1 : 0.5,
            }}>
              <strong>{p.name}</strong>: {
                roll
                  ? `🎲 ${roll.dice[0]} + ${roll.dice[1]} = ${roll.total}`
                  : pEligible
                    ? '等待掷骰子...'
                    : previousRoll
                      ? `🎲 ${previousRoll.total} (已淘汰)`
                      : '等待中...'}
            </div>
          );
        })}
      </div>
      {isEligible && !hasRolled && (
        <button
          onClick={() => sendAction('rollDice')}
          style={{
            padding: '8px 24px',
            fontSize: 16,
            background: isTieReroll ? '#ff9900' : undefined,
            color: isTieReroll ? 'white' : undefined,
            border: isTieReroll ? 'none' : undefined,
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          🎲 {isTieReroll ? '重掷骰子' : '掷骰子'}
        </button>
      )}
    </div>
  );
}

function CompetitionEnd({ game, playerId, sendAction }: Props) {
  const hasVoted = game.restartCompetitionVotes?.includes(playerId) ?? false;
  const voteCount = game.restartCompetitionVotes?.length ?? 0;

  return (
    <div style={{
      background: 'rgba(0,0,0,0.9)',
      padding: 32,
      borderRadius: 12,
      color: 'white',
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
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <button
          onClick={() => sendAction('voteRestartCompetition')}
          style={{
            padding: '8px 24px',
            fontSize: 16,
            background: hasVoted ? '#ff4444' : undefined,
            color: hasVoted ? 'white' : undefined,
            border: hasVoted ? 'none' : undefined,
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          重开比赛 {voteCount}/{game.players.length}
        </button>
        {voteCount > 0 && (
          <div style={{ fontSize: 10, color: '#ddd', marginTop: 4 }}>
            {game.restartCompetitionVotes!.map(id =>
              game.players.find(p => p.id === id)?.name
            ).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreSummary({ game }: { game: GameState }) {
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #555' }}>
      <p>当前分数：</p>
      {game.players.map(p => (
        <span key={p.id} style={{ marginRight: 12 }}>
          {p.name}: {game.playerScores[p.id]}
        </span>
      ))}
    </div>
  );
}

function HuangzhuangSettlement({ game, playerId, sendAction }: { game: GameState; playerId: string; sendAction: Props['sendAction'] }) {
  return (
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
        marginBottom: 12,
      }}>
        <p style={{ color: '#ffcc00', marginBottom: 4 }}>
          连续荒庄：{game.huangzhuangCount} 次
        </p>
        <p style={{ fontSize: 14, color: '#aaa' }}>
          下一局分数翻倍 ×{Math.pow(2, game.huangzhuangCount)}
        </p>
      </div>
      <p style={{ marginBottom: 8, color: '#aaa' }}>庄家不变</p>
      <ScoreSummary game={game} />
      <NextGameButton game={game} playerId={playerId} sendAction={sendAction} />
    </div>
  );
}

function WinnerSettlement({ game, playerId, sendAction }: { game: GameState; playerId: string; sendAction: Props['sendAction'] }) {
  const winner = game.winner!;
  return (
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
        <strong>{game.players.find(p => p.id === winner.playerId)?.name}</strong>
        {winner.winType === 'zimo' ? ' 自摸胡牌！' : ' 荣和胡牌！'}
      </p>
      {winner.patterns && (
        <div style={{ marginBottom: 12 }}>
          {winner.patterns.map((p, idx) => (
            <span key={idx} style={{
              background: '#444',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 12,
              marginRight: 4,
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
            color: sc.change > 0 ? '#4caf50' : '#f44336',
          }}>
            {game.players.find(p => p.id === sc.playerId)?.name}:
            {sc.change > 0 ? '+' : ''}{sc.change} ({sc.reason})
          </div>
        ))}
      </div>
      <ScoreSummary game={game} />
      <NextGameButton game={game} playerId={playerId} sendAction={sendAction} />
    </div>
  );
}

function NextGameButton({ game, playerId, sendAction }: { game: GameState; playerId: string; sendAction: Props['sendAction'] }) {
  const hasVoted = game.nextGameVotes?.includes(playerId) ?? false;
  const voteCount = game.nextGameVotes?.length ?? 0;

  return (
    <div style={{ marginTop: 16, textAlign: 'center' }}>
      <button
        onClick={() => sendAction('nextGame')}
        style={{
          padding: '8px 24px',
          fontSize: 16,
          background: hasVoted ? '#ff9900' : undefined,
          color: hasVoted ? 'white' : undefined,
          border: hasVoted ? 'none' : undefined,
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        下一局 {voteCount}/{game.players.length}
      </button>
      {voteCount > 0 && (
        <div style={{ fontSize: 10, color: '#ddd', marginTop: 4 }}>
          {game.nextGameVotes!.map(id =>
            game.players.find(p => p.id === id)?.name
          ).join(', ')}
        </div>
      )}
    </div>
  );
}
