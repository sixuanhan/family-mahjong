import type { Tile } from './types/tile';
import { toRiichiId, getTileComponent, Tile3D } from './Hand';

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
        maxWidth: 220,
      }}
    >
      {tiles.map((tile) => {
        const tileId = toRiichiId(tile);
        const RiichiComponent = getTileComponent(tileId);

        return (
          <Tile3D key={tile.id} width={40} height={56} depth={8}>
            {RiichiComponent && (
              <RiichiComponent width="100%" height="100%" />
            )}
          </Tile3D>
        );
      })}
    </div>
  );
}
