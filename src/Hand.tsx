import {
  RegularMan1, RegularMan2, RegularMan3, RegularMan4, RegularMan5, RegularMan6, RegularMan7, RegularMan8, RegularMan9,
  RegularPin1, RegularPin2, RegularPin3, RegularPin4, RegularPin5, RegularPin6, RegularPin7, RegularPin8, RegularPin9,
  RegularSou1, RegularSou2, RegularSou3, RegularSou4, RegularSou5, RegularSou6, RegularSou7, RegularSou8, RegularSou9,
  RegularTon, RegularNan, RegularShaa, RegularPei, RegularHaku, RegularHatsu, RegularChun,
} from 'riichi-mahjong-tiles';
import type { Tile as GameTile } from './types/tile';
import { Tile3D_standing, TableTile, type TileDirection } from './Tile3D';
import { useTileHover } from './hooks/useTileHover';

// 麻将牌组件映射表
export const tileComponentMap: Record<string, React.ComponentType<any>> = {
  // 万子 (Man)
  '1m': RegularMan1, '2m': RegularMan2, '3m': RegularMan3, '4m': RegularMan4, '5m': RegularMan5,
  '6m': RegularMan6, '7m': RegularMan7, '8m': RegularMan8, '9m': RegularMan9,
  // 饼子 (Pin)
  '1p': RegularPin1, '2p': RegularPin2, '3p': RegularPin3, '4p': RegularPin4, '5p': RegularPin5,
  '6p': RegularPin6, '7p': RegularPin7, '8p': RegularPin8, '9p': RegularPin9,
  // 索子 (Sou)
  '1s': RegularSou1, '2s': RegularSou2, '3s': RegularSou3, '4s': RegularSou4, '5s': RegularSou5,
  '6s': RegularSou6, '7s': RegularSou7, '8s': RegularSou8, '9s': RegularSou9,
  // 字牌 (Honors)
  '1z': RegularTon,   // 东
  '2z': RegularNan,   // 南
  '3z': RegularShaa,  // 西
  '4z': RegularPei,   // 北
  '5z': RegularHaku,  // 白
  '6z': RegularHatsu, // 发
  '7z': RegularChun,  // 中
};

// 把你的 GameTile 映射到 riichi-mahjong-tiles 需要的 id
export function toRiichiId(tile: GameTile): string {
  const { suit, value } = tile;
  let suitCode = '';
  if (suit === 'wan') suitCode = 'm';
  if (suit === 'tong') suitCode = 'p';
  if (suit === 'tiao') suitCode = 's';
  if (suit === 'wind' || suit === 'dragon') suitCode = 'z';
  
  // 花牌特殊处理
  if (suit === 'flower') {
    return `flower-${value}`;
  }

  // honor tiles 风/箭，根据 rank 值映射
  const honorMapping: Record<string, string> = {
    east: '1z',
    south: '2z',
    west: '3z',
    north: '4z',
    white: '5z',
    green: '6z',
    red: '7z',
  };

  if (suit === 'wind' || suit === 'dragon') {
    return honorMapping[value as string] || '5z';
  }

  return `${value}${suitCode}`;
}

// 花牌图片映射
import flowerImg1 from './assets/Image.jpg';
import flowerImg2 from './assets/Image (1).jpg';
import flowerImg3 from './assets/Image (2).jpg';
import flowerImg4 from './assets/Image (3).jpg';
import flowerImg5 from './assets/Image (4).jpg';
import flowerImg6 from './assets/Image (5).jpg';
import flowerImg7 from './assets/Image (7).jpg';
import flowerImg8 from './assets/Image (8).jpg';

const flowerImages: Record<string, string> = {
  spring: flowerImg1,
  summer: flowerImg2,
  autumn: flowerImg3,
  winter: flowerImg4,
  plum: flowerImg5,
  orchid: flowerImg6,
  bamboo: flowerImg7,
  chrysanthemum: flowerImg8,
};

// 获取花牌图片
export function getFlowerImage(id: string): string | undefined {
  const value = id.replace('flower-', '');
  return flowerImages[value];
}

// 根据牌 ID 获取对应的组件
export function getTileComponent(id: string) {
  return tileComponentMap[id];
}

export default function Hand({
  tiles,
  onSelect,
  selectedTileId,
  highlightedTileId,
}: {
  tiles: GameTile[];
  onSelect: (tile: GameTile) => void;
  selectedTileId?: string | null;
  highlightedTileId?: string | null;
}) {
  const { isSameTile, onTileHoverStart, onTileHoverEnd, tileHoverProps } = useTileHover();
  // 排序：条、饼、万、字牌（东南西北中发白）
  const suitOrder: Record<string, number> = { tiao: 0, tong: 1, wan: 2, wind: 3, dragon: 3 };
  const honorOrder = ['east', 'south', 'west', 'north', 'red', 'green', 'white'];

  const sorted = [...tiles].sort((a, b) => {
    const sa = suitOrder[a.suit] ?? 4;
    const sb = suitOrder[b.suit] ?? 4;
    if (sa !== sb) return sa - sb;
    // 同一花色：数字牌按 value 排序；字牌按 honorOrder
    if (sa === 3) {
      const ia = honorOrder.indexOf(a.value as string);
      const ib = honorOrder.indexOf(b.value as string);
      return ia - ib;
    }
    return (a.value as number) - (b.value as number);
  });

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', alignItems: 'flex-end', marginTop: 10, perspective: 900 }}>
      {sorted.map((tile, idx) => {
        const tileId = toRiichiId(tile);
        const RiichiComponent = getTileComponent(tileId);
        const flowerImage = tile.suit === 'flower' ? getFlowerImage(tileId) : undefined;
        const isSelected = tile.id === selectedTileId;
        const isHighlighted = tile.id === highlightedTileId;
        const isSameHovered = isSameTile(tile);
        const depth = 12;

        const hoverProps = tileHoverProps(tile);

        return (
          <div
            key={tile.id}
            className={isSameHovered ? 'tile-hover-highlight' : undefined}
            onClick={() => onSelect(tile)}
            onMouseEnter={(e) => {
              onTileHoverStart(tile);
              if (!isSelected) (e.currentTarget as HTMLElement).style.transform = 'translateY(-8px)';
            }}
            onMouseLeave={(e) => {
              onTileHoverEnd();
              if (!isSelected) (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
            onTouchStart={hoverProps.onTouchStart as React.TouchEventHandler}
            onTouchEnd={hoverProps.onTouchEnd as React.TouchEventHandler}
            onTouchCancel={hoverProps.onTouchCancel as React.TouchEventHandler}
            style={{
              marginRight: idx === sorted.length - 1 ? 0 : -Math.round(depth / 2),
              zIndex: idx,
              cursor: 'pointer',
              transition: 'transform 0.22s',
              transform: isSelected ? 'translateY(-18px)' : 'translateY(0)',
              display: 'inline-block',
            }}
          >
            <Tile3D_standing isSelected={isSelected} isHighlighted={isHighlighted} width={56} height={80} depth={depth}>
              {flowerImage ? (
                <img src={flowerImage} alt={tile.value as string} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} />
              ) : RiichiComponent ? (
                <RiichiComponent width="100%" height="100%" />
              ) : (
                <div style={{ color: 'red', fontSize: 12 }}>No component for {tileId}</div>
              )}
            </Tile3D_standing>
          </div>
        );
      })}
    </div>
  );
}

// 展示其他玩家的手牌（只显示牌背）
export function OtherPlayerHand({
  tileCount,
  direction,
  tileWidth = 40,
  tileHeight = 56,
  tiles,
  showFace = false,
}: {
  tileCount: number;
  direction: TileDirection;
  tileWidth?: number;
  tileHeight?: number;
  tiles?: GameTile[];
  showFace?: boolean;
}) {
  const { isSameTile, tileHoverProps } = useTileHover();
  // When showFace is true and tiles are available, render face-up TableTiles
  if (showFace && tiles && tiles.length > 0) {
    const suitOrder: Record<string, number> = { tiao: 0, tong: 1, wan: 2, wind: 3, dragon: 3, flower: 5 };
    const honorOrder = ['east', 'south', 'west', 'north', 'red', 'green', 'white'];
    const sorted = [...tiles].sort((a, b) => {
      const sa = suitOrder[a.suit] ?? 4;
      const sb = suitOrder[b.suit] ?? 4;
      if (sa !== sb) return sa - sb;
      if (sa === 3) return honorOrder.indexOf(a.value as string) - honorOrder.indexOf(b.value as string);
      return (a.value as number) - (b.value as number);
    });

    const isSideView = direction === 'left' || direction === 'right';

    return (
      <div style={{
        display: 'flex',
        flexDirection: isSideView ? 'column' : 'row',
        gap: 2,
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        {sorted.map(tile => {
          const tileId = toRiichiId(tile);
          const RiichiComponent = getTileComponent(tileId);
          const flowerImage = tile.suit === 'flower' ? getFlowerImage(tileId) : undefined;
          return (
            <div key={tile.id} className={isSameTile(tile) ? 'tile-hover-highlight' : undefined} {...tileHoverProps(tile)}>
              <TableTile width={tileWidth} height={tileHeight} radius={4} direction={direction}>
                {flowerImage ? (
                  <img src={flowerImage} alt="flower" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 3 }} />
                ) : RiichiComponent ? (
                  <RiichiComponent width="100%" height="100%" />
                ) : null}
              </TableTile>
            </div>
          );
        })}
      </div>
    );
  }

  const depth = 8;
  const isSideView = direction === 'left' || direction === 'right';
  // 侧视图使用更大的倾斜度
  const dy = isSideView ? depth : Math.round(depth / 2);
  
  // 对于 top 方向，使用原来的水平布局
  if (!isSideView) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {Array.from({ length: tileCount }).map((_, idx) => (
          <div
            key={idx}
            style={{
              marginRight: idx === tileCount - 1 ? 0 : -Math.round(depth / 2),
              zIndex: idx,
            }}
          >
            <Tile3D_standing
              width={tileWidth}
              height={tileHeight}
              depth={depth}
              direction={direction}
              showBack
            />
          </div>
        ))}
      </div>
    );
  }
  
  // 左右侧视图：斜向堆叠
  const sliver = Math.round(tileWidth * 0.3);
  const tileViewWidth = depth + sliver;
  const tileViewHeight = tileHeight + dy;
  
  // 每张牌只露出 dy（顶面高度）+ sliver 的部分
  const verticalStep = -dy; // 每张牌垂直方向只露出这么多
  const horizontalStep = sliver; // 水平偏移等于 sliver 宽度
  
  const totalWidth = tileViewWidth + (tileCount - 1) * horizontalStep;
  const totalHeight = tileViewHeight + (tileCount - 1) * verticalStep;

  return (
    <div
      style={{
        position: 'relative',
        width: totalWidth,
        height: totalHeight,
      }}
    >
      {Array.from({ length: tileCount }).map((_, idx) => {
        // 从后往前渲染，idx=0 是最后面的牌
        let left = 0;
        let top = 0;
        
        if (direction === 'left') {
          // 左侧：最前面的牌在左下，后面的牌依次向右上延伸
          left = (tileCount - 1 - idx) * horizontalStep;
          top = (tileCount - 1 - idx) * verticalStep;
        } else {
          // 右侧：最前面的牌在右下，后面的牌依次向左上延伸
          left = idx * horizontalStep;
          top = (tileCount - 1 - idx) * verticalStep;
        }

        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left,
              top,
              zIndex: idx, // 后面的牌 zIndex 更高
            }}
          >
            <Tile3D_standing
              width={tileWidth}
              height={tileHeight}
              depth={depth}
              direction={direction}
              showBack
            />
          </div>
        );
      })}
    </div>
  );
}
