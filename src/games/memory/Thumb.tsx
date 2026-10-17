const TILES: { x: number; y: number; value?: number }[] = [
  { x: 1, y: 0, value: 3 },
  { x: 4, y: 1, value: 1 },
  { x: 6, y: 0, value: 6 },
  { x: 2, y: 2, value: 5 },
  { x: 7, y: 3, value: 2 },
  { x: 0, y: 4, value: 7 },
  { x: 5, y: 3, value: 4 },
];

/** 数の記憶の盤面をそのまま縮めたもの */
export function Thumb() {
  const cell = 16;
  const left = (160 - cell * 8) / 2;
  const top = (90 - cell * 5) / 2;
  return (
    <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width={160} height={90} style={{ fill: "var(--bg)" }} />
      {Array.from({ length: 40 }, (_, i) => ({ x: i % 8, y: Math.floor(i / 8) }))
        .filter((p) => !TILES.some((t) => t.x === p.x && t.y === p.y))
        .map((p) => (
          <circle
            key={`dot-${p.x}-${p.y}`}
            cx={left + p.x * cell + cell / 2}
            cy={top + p.y * cell + cell / 2}
            r={0.8}
            style={{ fill: "var(--border)" }}
          />
        ))}
      {TILES.map((tile) => (
        <g
          key={`tile-${tile.x}-${tile.y}`}
          transform={`translate(${left + tile.x * cell} ${top + tile.y * cell})`}
        >
          <rect
            x={1.5}
            y={1.5}
            width={cell - 3}
            height={cell - 3}
            rx={2}
            style={{
              fill: tile.value === 1 ? "var(--primary)" : "var(--bg-subtle)",
              stroke: "var(--line)",
            }}
          />
          <text
            x={cell / 2}
            y={cell / 2 + 0.5}
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fill: tile.value === 1 ? "var(--on-primary)" : "var(--ink)",
              font: "600 8px var(--font-mono)",
            }}
          >
            {tile.value}
          </text>
        </g>
      ))}
    </svg>
  );
}
