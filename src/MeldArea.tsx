import { TableTile } from './Tile3D';
import type { Meld } from './types/player'
import { toRiichiId, getTileComponent } from './Hand';

export function MeldArea({
  melds,
}: {
  melds: Meld[]
}) {
  if (!melds || melds.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        marginBottom: 6,
        justifyContent: 'center',
      }}
    >
      {melds.map((meld, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 4,
          }}
        >
          {meld.tiles.map((tile) => {
            const riichiId = toRiichiId(tile);
            const TileComponent = getTileComponent(riichiId);
            
            return (
              <TableTile key={tile.id}>
                {TileComponent ? (
                  <TileComponent width="100%" height="100%" />
                ) : (
                  <div>?</div>
                )}
              </TableTile>
            );
          })}
        </div>
      ))}
    </div>
  );
}
