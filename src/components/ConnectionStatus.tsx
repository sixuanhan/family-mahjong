import type { ConnectionStatus as ConnectionStatusType } from '../hooks/useGameConnection';

export function ConnectionStatus({ status }: { status: ConnectionStatusType }) {
  if (status === 'connected') return null;

  return (
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
      background: status === 'disconnected' ? 'rgba(244,67,54,0.9)' : 'rgba(255,152,0,0.9)',
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
        animation: status === 'reconnecting' ? 'pulse 1.5s infinite' : 'none',
      }} />
      {status === 'reconnecting' ? '重新连接中...' : '连接已断开'}
    </div>
  );
}
