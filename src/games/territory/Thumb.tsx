const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
const COLS = 10;
const ROWS = 5;
const CELL = 14;
/** 盤の一部。数字はプレイヤー、-1 は空き */
const MAP = [
  0, 0, 0, -1, 1, 1, 1, 1, -1, -1, 0, -1, 0, -1, -1, 1, -1, 1, 2, 2, 0, 0, 0, -1, -1, 1, 1, 1, 2,
  -1, 3, -1, -1, -1, -1, -1, -1, 2, 2, 2, 3, 3, 3, -1, -1, -1, -1, 2, -1, -1,
];
const HEADS: { x: number; y: number; player: number }[] = [
  { x: 2, y: 1, player: 0 },
  { x: 6, y: 2, player: 1 },
  { x: 9, y: 0, player: 2 },
  { x: 2, y: 4, player: 3 },
];

/** 陣取りの盤面をそのまま縮めたもの */
export function Thumb() {
  const left = (160 - COLS * CELL) / 2;
  const top = (90 - ROWS * CELL) / 2;
  const cells = MAP.map((owner, cell) => ({
    owner,
    x: left + (cell % COLS) * CELL,
    y: top + Math.floor(cell / COLS) * CELL,
  }));
  return (
    <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width={160} height={90} style={{ fill: "var(--bg)" }} />
      {cells.map(({ owner, x, y }) =>
        owner < 0 ? (
          <circle
            key={`dot-${x}-${y}`}
            cx={x + CELL / 2}
            cy={y + CELL / 2}
            r={0.8}
            style={{ fill: "var(--border)" }}
          />
        ) : (
          <rect
            key={`cell-${x}-${y}`}
            x={x + 1}
            y={y + 1}
            width={CELL - 2}
            height={CELL - 2}
            rx={2}
            style={{ fill: COLORS[owner] }}
          />
        ),
      )}
      {HEADS.map((head) => (
        <g
          key={`head-${head.player}`}
          transform={`translate(${left + head.x * CELL} ${top + head.y * CELL})`}
        >
          <circle
            cx={CELL / 2}
            cy={CELL / 2}
            r={4.5}
            style={{ fill: "var(--bg)", stroke: "var(--ink)" }}
          />
          <text
            x={CELL / 2}
            y={CELL / 2 + 0.4}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fill: "var(--ink)", font: "600 6px var(--font-mono)" }}
          >
            {head.player + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
