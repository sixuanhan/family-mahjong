import type { Tile } from './types/tile';
import { toRiichiId, getTileComponent } from './Hand';
import { TableTile } from './Tile3D';

export default function DiscardArea({ tiles }: { tiles: Tile[] }) {
  if (!tiles || tiles.length === 0) {
    return <div style={{ height: 90 }} />;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0,
        maxWidth: '100%',
        justifyContent: 'center',
      }}
    >
      {tiles.map((tile) => {
        const tileId = toRiichiId(tile);
        const RiichiComponent = getTileComponent(tileId);

        return (
          <TableTile key={tile.id} width={40} height={56}>
            {RiichiComponent && (
              <RiichiComponent width="100%" height="100%" />
            )}
          </TableTile>
        );
      })}
    </div>
  );
}
