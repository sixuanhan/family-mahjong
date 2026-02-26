import { useState, useCallback, useRef, useEffect } from 'react';

export type EmojiType = 'tomato' | 'heart';

interface ThrowAnimation {
  id: string;
  emoji: EmojiType;
  targetPosition: 'top' | 'left' | 'right';
}

interface FlyingEmoji {
  id: string;
  emoji: EmojiType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

const EMOJI_MAP: Record<EmojiType, string> = {
  tomato: '🍅',
  heart: '❤️',
};

// Target positions relative to the 1400x900 game board
const TARGET_POSITIONS: Record<string, { x: number; y: number }> = {
  top: { x: 700, y: 60 },
  left: { x: 100, y: 400 },
  right: { x: 1300, y: 400 },
};

// The starting position of the emoji buttons (bottom-left)
const START_POSITION = { x: 60, y: 840 };

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
  const boardRef = useRef<HTMLDivElement | null>(null);

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

  // Process incoming throws from other players
  useEffect(() => {
    for (const t of incomingThrows) {
      const target = TARGET_POSITIONS[t.targetPosition];
      if (!target) {
        onThrowComplete(t.id);
        continue;
      }

      const flyId = t.id;
      // For incoming throws, animate FROM the thrower's direction TO the target
      // We'll animate from center to the target position
      const from = { x: 700, y: 450 }; // center of board

      setFlyingEmojis(prev => [...prev, {
        id: flyId,
        emoji: t.emoji,
        startX: from.x,
        startY: from.y,
        endX: target.x,
        endY: target.y,
      }]);

      // Clean up after animation
      setTimeout(() => {
        setFlyingEmojis(prev => prev.filter(f => f.id !== flyId));
        onThrowComplete(t.id);
      }, 800);
    }
  }, [incomingThrows, onThrowComplete]);

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
    e.preventDefault();
    setDragging(emoji);
    const pos = 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    setDragPos(pos);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const pos = 'touches' in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
      setDragPos(pos);
    };

    const handleUp = (e: MouseEvent | TouchEvent) => {
      const pos = 'changedTouches' in e ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY } : { x: e.clientX, y: e.clientY };
      const target = getDropTarget(pos.x, pos.y);

      if (target && dragging) {
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
          }]);

          setTimeout(() => {
            setFlyingEmojis(prev => prev.filter(f => f.id !== flyId));
          }, 800);
        }

        onThrow(dragging, target.playerId);
      }

      setDragging(null);
      setDragPos(null);
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
              cursor: 'grab',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              transition: 'transform 0.1s',
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
        <FlyingEmojiAnimation key={f.id} emoji={f.emoji} startX={f.startX} startY={f.startY} endX={f.endX} endY={f.endY} />
      ))}
    </>
  );
}

function FlyingEmojiAnimation({ emoji, startX, startY, endX, endY }: { emoji: EmojiType; startX: number; startY: number; endX: number; endY: number }) {
  const [phase, setPhase] = useState<'flying' | 'splat'>('flying');

  useEffect(() => {
    const timer = setTimeout(() => setPhase('splat'), 500);
    return () => clearTimeout(timer);
  }, []);

  const splatEmoji = emoji === 'tomato' ? '💥' : '💖';

  return (
    <div
      style={{
        position: 'absolute',
        left: phase === 'flying' ? endX : endX,
        top: phase === 'flying' ? endY : endY,
        fontSize: phase === 'splat' ? 64 : 48,
        pointerEvents: 'none',
        zIndex: 300,
        transform: phase === 'flying'
          ? `translate(-50%, -50%)`
          : `translate(-50%, -50%) scale(1.5)`,
        opacity: phase === 'splat' ? 0 : 1,
        transition: 'all 0.3s ease-out',
        animation: phase === 'flying'
          ? `throwFly 0.5s ease-in forwards`
          : 'throwSplat 0.3s ease-out forwards',
        '--start-x': `${startX}px`,
        '--start-y': `${startY}px`,
        '--end-x': `${endX}px`,
        '--end-y': `${endY}px`,
      } as React.CSSProperties}
    >
      {phase === 'flying' ? EMOJI_MAP[emoji] : splatEmoji}
    </div>
  );
}
