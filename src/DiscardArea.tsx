import type { Tile } from './types/tile';
import { toRiichiId, getTileComponent } from './Hand';
import { TableTile, type TileDirection } from './Tile3D';

export default function DiscardArea({ 
  tiles, 
  direction = 'bottom',
  highlightedTileId,
}: { 
  tiles: Tile[];
  direction?: TileDirection;
  highlightedTileId?: string;
}) {
  const tileWidth = 40;
  const tileHeight = 56;
  const columns = 12;

  // 左右侧：竖向排列（12个一列）
  if (direction === 'left' || direction === 'right') {
    const rows = 12;
    const columnCount = Math.ceil(tiles.length / rows) || 1;
    const rotatedWidth = tileHeight; // 旋转后宽度是原来的高度
    const rotatedHeight = tileWidth; // 旋转后高度是原来的宽度
    
    // left: 第一张在右上角，从上到下填满后往左换列 → 用 direction: rtl
    // right: 第一张在左下角，从下到上填满后往右换列 → 用 scaleY(-1) 翻转
    
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateRows: `repeat(${rows}, ${rotatedHeight}px)`,
          gridTemplateColumns: `repeat(${columnCount}, ${rotatedWidth}px)`,
          gridAutoFlow: 'column',
          gap: 2,
          justifyContent: 'start',
          alignContent: 'start',
          direction: direction === 'left' ? 'rtl' : 'ltr',
          transform: direction === 'right' ? 'scaleY(-1)' : 'none',
        }}
      >
        {tiles.map((tile) => {
          const tileId = toRiichiId(tile);
          const RiichiComponent = getTileComponent(tileId);
          const isHighlighted = tile.id === highlightedTileId;

          return (
            <div
              key={tile.id}
              style={{
                transform: direction === 'right' ? 'scaleY(-1)' : 'none',
              }}
            >
              <TableTile width={tileWidth} height={tileHeight} direction={direction} isHighlighted={isHighlighted}>
                {RiichiComponent && (
                  <RiichiComponent width="100%" height="100%" />
                )}
              </TableTile>
            </div>
          );
        })}
      </div>
    );
  }

  // top: 对对面玩家而言，从右到左是他的「从左到右」
  const displayTiles = direction === 'top' ? [...tiles].reverse() : tiles;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, ${tileWidth}px)`,
          gridAutoRows: `${tileHeight + 4}px`,
          gap: 0,
          justifyContent: 'start',
          alignContent: 'start',
          direction: direction === 'top' ? 'rtl' : 'ltr',
          minHeight: (tileHeight + 4) * 2,
        }}
      >
        {displayTiles.map((tile) => {
          const tileId = toRiichiId(tile);
          const RiichiComponent = getTileComponent(tileId);
          const isHighlighted = tile.id === highlightedTileId;

          return (
            <TableTile key={tile.id} width={tileWidth} height={tileHeight} direction={direction} isHighlighted={isHighlighted}>
              {RiichiComponent && (
                <RiichiComponent width="100%" height="100%" />
              )}
            </TableTile>
          );
        })}
      </div>
    </div>
  );
}
