// SVG-based Tile3D_standing：精确绘制 front/top/right 三个面，并在 front 上放置牌面子元素
export function Tile3D_standing({
  width = 56,
  height = 80,
  depth = 12,
  radius = 6,
  isSelected = false,
  children,
}: {
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
  isSelected?: boolean;
  children?: React.ReactNode;
}) {
  const dx = depth;
  const dy = Math.round(depth / 2);
  const viewW = width + dx;
  const viewH = height + dy;

  const topFill = isSelected ? '#c8f9d6' : '#f0fbf2';
  const rightFill = isSelected ? '#9fe6a9' : '#dff5de';
  const frontFill = isSelected ? '#b9f6ca' : '#e8f5e9';
  const stroke = 'rgba(76,175,80,0.9)';

  return (
    <div style={{ position: 'relative', width, height: height + dy, boxSizing: 'border-box' }}>
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
          fill={rightFill}
          stroke={stroke}
          strokeWidth={1.5}
        />
        {/* front face (rounded rect) */}
        <rect x={0} y={dy} rx={radius} ry={radius} width={width} height={height} fill={frontFill} stroke={stroke} strokeWidth={1.5} />
      </svg>

      {/* place the child SVG (tile face) on top of front face */}
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
    </div>
  );
}

export function TableTile({
  width = 48,
  height = 64,
  radius = 6,
  isHighlighted = false,
  children,
}: {
  width?: number;
  height?: number;
  radius?: number;
  isHighlighted?: boolean;
  children?: React.ReactNode;
}) {
  const fill = isHighlighted ? '#d7ffd9' : '#f5f5f5';
  const stroke = 'rgba(0,0,0,0.25)';

  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: fill,
        border: `1.5px solid ${stroke}`,
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        transform: 'rotateX(10deg)'
      }}
    >
      {children}
    </div>
  );
}
