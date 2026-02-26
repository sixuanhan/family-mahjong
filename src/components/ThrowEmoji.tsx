import { useState, useCallback, useRef, useEffect } from 'react';
import { queueSpeakChinese } from '../game/tileUtils';

export type EmojiType = 'tomato' | 'heart';

interface ThrowAnimation {
  id: string;
  emoji: EmojiType;
  fromPosition: 'top' | 'left' | 'right' | 'bottom';
  targetPosition: 'top' | 'left' | 'right' | 'bottom';
}

interface FlyingEmoji {
  id: string;
  emoji: EmojiType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  throwId: string; // unique throw ID for voice dedup
}

const EMOJI_MAP: Record<EmojiType, string> = {
  tomato: '🍅',
  heart: '❤️',
};

const VOICE_LINES: Record<EmojiType, string> = {
  tomato: '不会打牌就下桌子',
  heart: '你牌打得也太好了',
};

// Target positions relative to the 1400x900 game board
const TARGET_POSITIONS: Record<string, { x: number; y: number }> = {
  top: { x: 700, y: 60 },
  left: { x: 100, y: 400 },
  right: { x: 1300, y: 400 },
  bottom: { x: 700, y: 800 },
};

// The starting position of the emoji buttons (bottom-left)
const START_POSITION = { x: 60, y: 840 };

// Module-level deduplication: ensures each throw ID speaks exactly once,
// even if the component remounts or multiple instances exist.
const spokenThrowIds = new Set<string>();

interface ThrowEmojiProps {
  onThrow: (emoji: EmojiType, targetPlayerId: string) => void;
  topPlayerId?: string | null;
  leftPlayerId?: string | null;
  rightPlayerId?: string | null;
  incomingThrows: ThrowAnimation[];
  onThrowComplete: (id: string) => void;
}

export function ThrowEmoji({ onThrow, topPlayerId, leftPlayerId, rightPlayerId, incomingThrows, onThrowComplete }: ThrowEmojiProps) {
  const [flyingEmojis, setFlyingEmojis] = useState<FlyingEmoji[]>([]);
  const [dragging, setDragging] = useState<EmojiType | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const throwInProgress = useRef(false);

  // Find the game board element (parent with position: relative and 1400x900)
  const getBoard = useCallback(() => {
    if (boardRef.current) return boardRef.current;
    // Walk up from any emoji button to find the game board
    const boards = document.querySelectorAll<HTMLDivElement>('[data-game-board]');
    if (boards.length > 0) {
      boardRef.current = boards[0];
      return boards[0];
    }
    return null;
  }, []);

  // Process incoming throws — use ref to ensure each throw is handled exactly once
  const processedThrows = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const t of incomingThrows) {
      if (processedThrows.current.has(t.id)) continue;
      processedThrows.current.add(t.id);

      const target = TARGET_POSITIONS[t.targetPosition];
      const from = TARGET_POSITIONS[t.fromPosition];
      if (!target || !from) {
        onThrowComplete(t.id);
        continue;
      }

      const flyId = t.id;

      setFlyingEmojis(prev => [...prev, {
        id: flyId,
        emoji: t.emoji,
        startX: from.x,
        startY: from.y,
        endX: target.x,
        endY: target.y,
        throwId: t.id,
      }]);

      // Clean up after animation
      setTimeout(() => {
        setFlyingEmojis(prev => prev.filter(f => f.id !== flyId));
        onThrowComplete(t.id);
      }, 1200);
    }
  }); // no dependency array — runs every render but deduplicates via ref

  const getDropTarget = useCallback((clientX: number, clientY: number): { position: string; playerId: string } | null => {
    const board = getBoard();
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const scaleX = 1400 / rect.width;
    const scaleY = 900 / rect.height;
    const bx = x * scaleX;
    const by = y * scaleY;

    // Check which player area was hit
    if (topPlayerId && by < 200 && bx > 200 && bx < 1200) return { position: 'top', playerId: topPlayerId };
    if (leftPlayerId && bx < 250 && by > 120 && by < 700) return { position: 'left', playerId: leftPlayerId };
    if (rightPlayerId && bx > 1150 && by > 120 && by < 700) return { position: 'right', playerId: rightPlayerId };
    return null;
  }, [getBoard, topPlayerId, leftPlayerId, rightPlayerId]);

  const handleDragStart = useCallback((emoji: EmojiType, e: React.MouseEvent | React.TouchEvent) => {
    if (cooldown) return;
    e.preventDefault();
    setDragging(emoji);
    const pos = 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    setDragPos(pos);
  }, [cooldown]);

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const pos = 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
      setDragPos(pos);
    };

    const handleUp = (e: MouseEvent | TouchEvent) => {
      // Guard: on touch devices, both touchend and mouseup fire — only handle the first
      if (throwInProgress.current) return;
      if (!dragging) return;
      throwInProgress.current = true;

      const pos = 'changedTouches' in e ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY } : { x: e.clientX, y: e.clientY };
      const target = getDropTarget(pos.x, pos.y);

      if (target) {
        // Trigger the throw animation locally
        if (getBoard()) {
          const endTarget = TARGET_POSITIONS[target.position];
          const flyId = `local-${Date.now()}-${Math.random()}`;

          setFlyingEmojis(prev => [...prev, {
            id: flyId,
            emoji: dragging,
            startX: START_POSITION.x,
            startY: START_POSITION.y,
            endX: endTarget.x,
            endY: endTarget.y,
            throwId: flyId,
          }]);

          setTimeout(() => {
            setFlyingEmojis(prev => prev.filter(f => f.id !== flyId));
          }, 1200);
        }

        // Start cooldown (matches server's 3s)
        setCooldown(true);
        setTimeout(() => setCooldown(false), 3000);

        onThrow(dragging, target.playerId);
      }

      setDragging(null);
      setDragPos(null);
      // Reset the guard after a tick so next drag session works
      setTimeout(() => { throwInProgress.current = false; }, 50);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [dragging, getDropTarget, getBoard, onThrow]);

  return (
    <>
      {/* Emoji buttons in bottom-left */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: 20,
        display: 'flex',
        gap: 8,
        zIndex: 100,
      }}>
        {(['tomato', 'heart'] as EmojiType[]).map(emoji => (
          <div
            key={emoji}
            onMouseDown={e => handleDragStart(emoji, e)}
            onTouchStart={e => handleDragStart(emoji, e)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              cursor: cooldown ? 'not-allowed' : 'grab',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              transition: 'transform 0.1s, opacity 0.2s',
              opacity: cooldown ? 0.4 : 1,
            }}
            title={emoji === 'tomato' ? '拖到其他玩家扔🍅' : '拖到其他玩家送❤️'}
          >
            {EMOJI_MAP[emoji]}
          </div>
        ))}
      </div>

      {/* Dragging ghost */}
      {dragging && dragPos && (
        <div style={{
          position: 'fixed',
          left: dragPos.x - 20,
          top: dragPos.y - 20,
          fontSize: 40,
          pointerEvents: 'none',
          zIndex: 10000,
          filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
          transition: 'none',
        }}>
          {EMOJI_MAP[dragging]}
        </div>
      )}

      {/* Drop zone highlights while dragging */}
      {dragging && (
        <>
          {topPlayerId && (
            <div style={{ position: 'absolute', top: 0, left: 200, width: 1000, height: 130, border: '3px dashed rgba(255,255,255,0.4)', borderRadius: 12, pointerEvents: 'none', zIndex: 50 }} />
          )}
          {leftPlayerId && (
            <div style={{ position: 'absolute', top: 120, left: 0, width: 200, height: 580, border: '3px dashed rgba(255,255,255,0.4)', borderRadius: 12, pointerEvents: 'none', zIndex: 50 }} />
          )}
          {rightPlayerId && (
            <div style={{ position: 'absolute', top: 120, right: 0, width: 200, height: 580, border: '3px dashed rgba(255,255,255,0.4)', borderRadius: 12, pointerEvents: 'none', zIndex: 50 }} />
          )}
        </>
      )}

      {/* Flying emoji animations */}
      {flyingEmojis.map(f => (
        <FlyingEmojiAnimation key={f.id} emoji={f.emoji} startX={f.startX} startY={f.startY} endX={f.endX} endY={f.endY} throwId={f.throwId} />
      ))}
    </>
  );
}

function FlyingEmojiAnimation({ emoji, startX, startY, endX, endY, throwId }: { emoji: EmojiType; startX: number; startY: number; endX: number; endY: number; throwId: string }) {
  const [phase, setPhase] = useState<'flying' | 'splat' | 'done'>('flying');
  const [pos, setPos] = useState({ x: startX, y: startY });
  const [rotation, setRotation] = useState(0);
  const rafRef = useRef<number>(0);
  const startTime = useRef(performance.now());

  const FLIGHT_DURATION = 500; // ms
  const ARC_HEIGHT = -180; // negative = upward arc

  useEffect(() => {
    startTime.current = performance.now();

    // Speak voice line exactly once per throwId (module-level dedup)
    if (!spokenThrowIds.has(throwId)) {
      spokenThrowIds.add(throwId);
      // Clean up old IDs after 10s to prevent memory leak
      setTimeout(() => spokenThrowIds.delete(throwId), 10000);
      setTimeout(() => {
        queueSpeakChinese(VOICE_LINES[emoji]);
      }, 500);
    }

    const animate = (now: number) => {
      const elapsed = now - startTime.current;
      const t = Math.min(elapsed / FLIGHT_DURATION, 1);

      // Ease-out for deceleration on arrival
      const eased = 1 - Math.pow(1 - t, 2);

      // Linear interpolation for X
      const x = startX + (endX - startX) * eased;

      // Parabolic arc for Y: lerp + parabola offset
      const linearY = startY + (endY - startY) * eased;
      const arcOffset = ARC_HEIGHT * 4 * eased * (1 - eased); // peaks at t=0.5
      const y = linearY + arcOffset;

      // Spin rotation
      const rot = eased * 720;

      setPos({ x, y });
      setRotation(rot);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setPhase('splat');
        setTimeout(() => setPhase('done'), 600);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [startX, startY, endX, endY]);

  if (phase === 'done') return null;

  const splatEmoji = emoji === 'tomato' ? '💥' : '💖';

  if (phase === 'flying') {
    return (
      <div
        style={{
          position: 'absolute',
          left: pos.x,
          top: pos.y,
          fontSize: 48,
          pointerEvents: 'none',
          zIndex: 300,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
        }}
      >
        {EMOJI_MAP[emoji]}
      </div>
    );
  }

  // Splat phase
  return (
    <div
      style={{
        position: 'absolute',
        left: endX,
        top: endY,
        pointerEvents: 'none',
        zIndex: 300,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Impact burst */}
      <div style={{
        fontSize: 64,
        animation: 'splatBurst 0.6s ease-out forwards',
      }}>
        {splatEmoji}
      </div>
      {/* Particle splashes */}
      {[...Array(6)].map((_, i) => {
        const angle = (i / 6) * 360;
        const distance = 30 + Math.random() * 20;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              fontSize: emoji === 'tomato' ? 18 : 16,
              pointerEvents: 'none',
              animation: `splatParticle 0.6s ease-out forwards`,
              '--angle': `${angle}deg`,
              '--distance': `${distance}px`,
            } as React.CSSProperties}
          >
            {emoji === 'tomato' ? '🍅' : '💕'}
          </div>
        );
      })}
    </div>
  );
}
