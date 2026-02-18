import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { Tile } from '../types/tile';

function tileKey(tile: Tile): string {
  return `${tile.suit}:${tile.value}`;
}

interface TileHoverContextValue {
  hoveredKey: string | null;
  /** Returns true if this tile matches the currently hovered tile identity */
  isSameTile: (tile: Tile) => boolean;
  /** Call on mouse enter / touch start */
  onTileHoverStart: (tile: Tile) => void;
  /** Call on mouse leave / touch end */
  onTileHoverEnd: () => void;
  /** Props to spread onto any tile wrapper element */
  tileHoverProps: (tile: Tile) => Record<string, unknown>;
}

const TileHoverContext = createContext<TileHoverContextValue | null>(null);

export function TileHoverProvider({ children }: { children: React.ReactNode }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTouchKey = useRef<string | null>(null);

  const isSameTile = useCallback(
    (tile: Tile) => hoveredKey !== null && tileKey(tile) === hoveredKey,
    [hoveredKey],
  );

  const onTileHoverStart = useCallback((tile: Tile) => {
    setHoveredKey(tileKey(tile));
  }, []);

  const onTileHoverEnd = useCallback(() => {
    setHoveredKey(null);
  }, []);

  const tileHoverProps = useCallback(
    (tile: Tile): Record<string, unknown> => {
      const key = tileKey(tile);
      return {
        onMouseEnter: () => setHoveredKey(key),
        onMouseLeave: () => setHoveredKey((prev) => (prev === key ? null : prev)),
        onTouchStart: () => {
          const timer = setTimeout(() => {
            setHoveredKey(key);
            activeTouchKey.current = key;
          }, 300);
          longPressTimer.current = timer;
        },
        onTouchEnd: () => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
          if (activeTouchKey.current === key) {
            setHoveredKey(null);
            activeTouchKey.current = null;
          }
        },
        onTouchCancel: () => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
          if (activeTouchKey.current === key) {
            setHoveredKey(null);
            activeTouchKey.current = null;
          }
        },
      };
    },
    [],
  );

  return (
    <TileHoverContext.Provider
      value={{ hoveredKey, isSameTile, onTileHoverStart, onTileHoverEnd, tileHoverProps }}
    >
      {children}
    </TileHoverContext.Provider>
  );
}

export function useTileHover() {
  const ctx = useContext(TileHoverContext);
  if (!ctx) throw new Error('useTileHover must be used within TileHoverProvider');
  return ctx;
}
