import { TableTile, type TileDirection } from './Tile3D';
import type { Meld } from './types/player'
import { toRiichiId, getTileComponent } from './Hand';

export function MeldArea({
  melds,
  direction = 'bottom',
}: {
  melds: Meld[];
  direction?: TileDirection;
}) {
  if (!melds || melds.length === 0) return null;

  const isSideView = direction === 'left' || direction === 'right';
  
  // top: 对对面而言从右到左是他的「从左到右」
  // left: 对左侧而言从下到上是他的「从左到右」
  const displayMelds = (direction === 'top' || direction === 'left') ? [...melds].reverse() : melds;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isSideView ? 'column' : 'row',
        gap: 8,
        marginBottom: 6,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {displayMelds.map((meld, i) => {
        // 每个副露内的牌也需要反转 for top/left
        const displayTiles = (direction === 'top' || direction === 'left') ? [...meld.tiles].reverse() : meld.tiles;
        
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: isSideView ? 'column' : 'row',
              gap: 2,
            }}
          >
            {displayTiles.map((tile) => {
              const riichiId = toRiichiId(tile);
              const TileComponent = getTileComponent(riichiId);
              
              return (
                <TableTile key={tile.id} direction={direction}>
                  {TileComponent ? (
                    <TileComponent width="100%" height="100%" />
                  ) : (
                    <div>?</div>
                  )}
                </TableTile>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
