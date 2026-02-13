export type TileDirection = 'bottom' | 'left' | 'top' | 'right';

// SVG-based Tile3D_standing：精确绘制 front/top/right 三个面，并在 front 上放置牌面子元素
export function Tile3D_standing({
  width = 56,
  height = 80,
  depth = 12,
  radius = 6,
  isSelected = false,
  isHighlighted = false,
  direction = 'bottom',
  showBack = false,
  children,
}: {
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
  isSelected?: boolean;
  isHighlighted?: boolean;
  direction?: TileDirection;
  showBack?: boolean;
  children?: React.ReactNode;
}) {
  const dx = depth;
  // 左右方向显示侧视图（窄边朝向观众，能看到一部分正/背面）
  const isSideView = direction === 'left' || direction === 'right';
  // 侧视图使用更大的倾斜度
  const dy = isSideView ? depth : Math.round(depth / 2);

  // 高亮新摸的牌使用明亮的黄色调
  const topFill = isHighlighted ? '#fff59d' : isSelected ? '#c8f9d6' : '#f0fbf2';
  const sideFill = isHighlighted ? '#ffee58' : isSelected ? '#9fe6a9' : '#dff5de';
  const frontFill = isHighlighted ? '#fffde7' : isSelected ? '#b9f6ca' : '#e8f5e9';
  const backFill = '#4a7c59'; // 牌背面颜色（深绿色）
  const stroke = isHighlighted ? 'rgba(255,193,7,1)' : 'rgba(76,175,80,0.9)';
  
  if (isSideView) {
    // 侧视图：以侧面为主，显示一部分正面/背面
    const sliver = Math.round(width * 0.3); // 可见的正面/背面宽度
    const viewW = depth + sliver;
    const viewH = height + dy;
    
    // left: 侧面在左，背面在右侧延伸
    // right: 侧面在右，背面在左侧延伸
    const sliverOnRight = direction === 'left';

    return (
      <div 
        style={{ 
          position: 'relative', 
          width: viewW, 
          height: viewH, 
          boxSizing: 'border-box',
        }}
      >
        <svg
          width={viewW}
          height={viewH}
          viewBox={`0 0 ${viewW} ${viewH}`}
          style={{ display: 'block' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {sliverOnRight ? (
            <>
              {/* 背面/正面 sliver (parallelogram on right) */}
              <polygon
                points={`${depth},${dy} ${depth + sliver},0 ${depth + sliver},${height} ${depth},${dy + height}`}
                fill={backFill}
                stroke={stroke}
                strokeWidth={1.5}
              />
              {/* top face */}
              <polygon
                points={`0,${dy} ${depth},${dy} ${depth + sliver},0 ${sliver},0`}
                fill={topFill}
                stroke={stroke}
                strokeWidth={1.5}
              />
              {/* side face (main visible narrow edge) */}
              <rect 
                x={0} 
                y={dy} 
                rx={2} 
                ry={2} 
                width={depth} 
                height={height} 
                fill={sideFill} 
                stroke={stroke} 
                strokeWidth={1.5} 
              />
            </>
          ) : (
            <>
              {/* 背面/正面 sliver (parallelogram on left) */}
              <polygon
                points={`0,0 ${sliver},${dy} ${sliver},${dy + height} 0,${height}`}
                fill={backFill}
                stroke={stroke}
                strokeWidth={1.5}
              />
              {/* top face */}
              <polygon
                points={`0,0 ${depth},0 ${sliver + depth},${dy} ${sliver},${dy}`}
                fill={topFill}
                stroke={stroke}
                strokeWidth={1.5}
              />
              {/* side face (main visible narrow edge) */}
              <rect 
                x={sliver} 
                y={dy} 
                rx={2} 
                ry={2} 
                width={depth} 
                height={height} 
                fill={sideFill} 
                stroke={stroke} 
                strokeWidth={1.5} 
              />
            </>
          )}
        </svg>
      </div>
    );
  }

  // 正面视图（bottom/top）
  const viewW = width + dx;
  const viewH = height + dy;

  return (
    <div 
      style={{ 
        position: 'relative', 
        width: width, 
        height: height + dy, 
        boxSizing: 'border-box',
      }}
    >
      <svg
        width={viewW}
        height={viewH}
        viewBox={`0 0 ${viewW} ${viewH}`}
        style={{ display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* top face (trapezoid) */}
        <polygon
          points={`${dx},0 ${dx + width},0 ${width},${dy} 0,${dy}`}
          fill={topFill}
          stroke={stroke}
          strokeWidth={1.5}
        />
        
        {/* right face */}
        <polygon
          points={`${width},${dy} ${width + dx},0 ${width + dx},${height} ${width},${dy + height}`}
          fill={sideFill}
          stroke={stroke}
          strokeWidth={1.5}
        />
        
        {/* front face (rounded rect) */}
        <rect 
          x={0} 
          y={dy} 
          rx={radius} 
          ry={radius} 
          width={width} 
          height={height} 
          fill={showBack ? backFill : frontFill} 
          stroke={stroke} 
          strokeWidth={1.5} 
        />
      </svg>

      {/* place the child SVG (tile face) on top of front face */}
      {!showBack && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: dy,
            width,
            height,
            padding: 6,
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        >
          <div style={{ width: '100%', height: '100%' }}>{children}</div>
        </div>
      )}
    </div>
  );
}

export function TableTile({
  width = 48,
  height = 64,
  radius = 6,
  isHighlighted = false,
  direction = 'bottom',
  children,
}: {
  width?: number;
  height?: number;
  radius?: number;
  isHighlighted?: boolean;
  direction?: TileDirection;
  children?: React.ReactNode;
}) {
  const fill = isHighlighted ? '#fff9c4' : '#f5f5f5';
  const stroke = isHighlighted ? '#ff9800' : 'rgba(0,0,0,0.25)';
  const boxShadowStyle = isHighlighted 
    ? '0 0 8px 2px rgba(255, 152, 0, 0.6), 0 2px 4px rgba(0,0,0,0.15)' 
    : '0 2px 4px rgba(0,0,0,0.15)';
  
  // 根据方向设置旋转角度
  const rotationMap: Record<TileDirection, number> = {
    bottom: 0,
    left: 90,
    top: 180,
    right: 270,
  };
  const rotation = rotationMap[direction];
  
  // 左右方向旋转90度，外层容器宽高交换
  const isSideView = direction === 'left' || direction === 'right';
  const containerWidth = isSideView ? height : width;
  const containerHeight = isSideView ? width : height;

  return (
    <div
      style={{
        width: containerWidth,
        height: containerHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width,
          height,
          borderRadius: radius,
          background: fill,
          border: `1.5px solid ${stroke}`,
          boxShadow: boxShadowStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          transform: `rotate(${rotation}deg)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
