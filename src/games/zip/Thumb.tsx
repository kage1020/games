const SIZE = 5;
const CELL = 16;
const LEFT = (160 - CELL * SIZE) / 2;
const TOP = (90 - CELL * SIZE) / 2;
/** 盤の途中まで引いた道 */
const PATH = [0, 1, 6, 5, 10, 11, 12, 7, 2, 3, 4, 9, 14];
const CHECKPOINTS: { cell: number; number: number }[] = [
  { cell: 0, number: 1 },
  { cell: 12, number: 2 },
  { cell: 14, number: 3 },
  { cell: 21, number: 4 },
  { cell: 24, number: 5 },
];

const centerOf = (cell: number) => ({
  x: LEFT + (cell % SIZE) * CELL + CELL / 2,
  y: TOP + Math.floor(cell / SIZE) * CELL + CELL / 2,
});

/** 点つなぎの盤面をそのまま縮めたもの */
export function Thumb() {
  const cells = Array.from({ length: SIZE * SIZE }, (_, cell) => ({ cell, ...centerOf(cell) }));
  return (
    <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width={160} height={90} style={{ fill: "var(--bg)" }} />
      {cells.map(({ cell, x, y }) => (
        <g key={`cell-${cell}`}>
          <rect
            x={x - CELL / 2 + 0.75}
            y={y - CELL / 2 + 0.75}
            width={CELL - 1.5}
            height={CELL - 1.5}
            rx={1.5}
            style={{ fill: "var(--bg-subtle)" }}
          />
          <circle cx={x} cy={y} r={0.6} style={{ fill: "var(--border)" }} />
        </g>
      ))}
      <polyline
        points={PATH.map((cell) => {
          const { x, y } = centerOf(cell);
          return `${x},${y}`;
        }).join(" ")}
        style={{
          fill: "none",
          stroke: "var(--accent)",
          strokeWidth: 6.4,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }}
      />
      {CHECKPOINTS.map(({ cell, number }) => {
        const { x, y } = centerOf(cell);
        return (
          <g key={`checkpoint-${number}`}>
            <circle cx={x} cy={y} r={4.8} style={{ fill: "var(--primary)" }} />
            <text
              x={x}
              y={y + 0.3}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ fill: "var(--on-primary)", font: "600 5.5px var(--font-mono)" }}
            >
              {number}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
