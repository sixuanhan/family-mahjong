import { useState, useRef, useEffect, useCallback } from 'react';
import type { GameState } from '../game/gameState';
import type { EmojiType } from '../components/ThrowEmoji';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface RestoreInfo {
  players: { id: string; name: string }[];
  claims: Record<string, string>; // newPlayerId -> oldPlayerId
  started: boolean;
}

export function useGameConnection() {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 20;
  const isUnmounting = useRef(false);

  const [game, setGame] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [restoreInfo, setRestoreInfo] = useState<RestoreInfo | null>(null);
  const [throwEmojiEvents, setThrowEmojiEvents] = useState<{ id: string; fromPlayerId: string; toPlayerId: string; emoji: EmojiType }[]>([]);

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
          if (msg.restoreAvailable) {
            setRestoreInfo(msg.restoreAvailable);
          } else {
            setRestoreInfo(null);
          }
          return;
        }

        if (msg.type === 'sync') {
          setGame(msg.game);
          setRestoreInfo(null); // Restore is over if game is syncing
          return;
        }

        if (msg.type === 'restoreUpdate') {
          setRestoreInfo({
            players: msg.players,
            claims: msg.claims,
            started: msg.started,
          });
          return;
        }

        if (msg.type === 'restoreCancelled') {
          setRestoreInfo(null);
          setGame(msg.game);
          // Re-join the fresh game
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'join' }));
          }
          return;
        }

        if (msg.type === 'throwEmoji') {
          const serverThrowId = msg.id;
          // Deduplicate: if we already have this server-generated ID, skip
          setThrowEmojiEvents(prev => {
            if (prev.some(e => e.id === serverThrowId)) return prev;
            return [...prev, {
              id: serverThrowId,
              fromPlayerId: msg.fromPlayerId,
              toPlayerId: msg.toPlayerId,
              emoji: msg.emoji as EmojiType,
            }];
          });
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
    if (!ws.current || !playerId || ws.current.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ action: 'join' }));
  }, [playerId]);

  const sendAction = useCallback((action: string, payload: Record<string, unknown> = {}) => {
    console.log('[Client] sendAction:', action, payload);
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action, ...payload }));
    } else {
      console.warn('[Client] WebSocket not ready, action not sent');
    }
  }, []);

  const clearThrowEvent = useCallback((id: string) => {
    setThrowEmojiEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  return { game, playerId, connectionStatus, sendAction, restoreInfo, throwEmojiEvents, clearThrowEvent };
}
