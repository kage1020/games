const COLS = 8;
const ROWS = 4;
/** 崩れたところ（列, 段） */
const GONE = new Set(["2,3", "3,3", "3,2", "6,3", "5,3"]);

const BRICKS = Array.from({ length: COLS * ROWS }, (_, i) => ({
  col: i % COLS,
  row: Math.floor(i / COLS),
}))
  .filter((brick) => !GONE.has(`${brick.col},${brick.row}`))
  .map((brick) => ({ ...brick, id: `brick-${brick.col}-${brick.row}` }));

/** ブロック崩しの画面をそのまま縮めたもの */
export function Thumb() {
  const width = 15;
  const height = 6;
  const gap = 2;
  const left = (160 - (width * COLS + gap * (COLS - 1))) / 2;
  return (
    <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width={160} height={90} style={{ fill: "var(--bg)" }} />
      {BRICKS.map((brick) => (
        <rect
          key={brick.id}
          x={left + brick.col * (width + gap)}
          y={10 + brick.row * (height + gap)}
          width={width}
          height={height}
          rx={1}
          style={{ fill: "var(--ink)" }}
        />
      ))}
      <circle cx={88} cy={56} r={3} style={{ fill: "var(--accent)" }} />
      <rect x={66} y={78} width={30} height={4} rx={1.5} style={{ fill: "var(--primary)" }} />
    </svg>
  );
}
