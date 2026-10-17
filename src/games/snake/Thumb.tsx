const CELL = 10;
const BODY: [number, number][] = [
  [9, 3],
  [8, 3],
  [7, 3],
  [6, 3],
  [6, 4],
  [6, 5],
  [7, 5],
  [8, 5],
];

/** スネークの盤面をそのまま縮めたもの */
export function Thumb() {
  const dots: [number, number][] = [];
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 16; x++) {
      if (!BODY.some(([bx, by]) => bx === x && by === y)) dots.push([x, y]);
    }
  }
  const [head, ...rest] = BODY;
  return (
    <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width={160} height={90} style={{ fill: "var(--bg)" }} />
      {dots.map(([x, y]) => (
        <circle
          key={`dot-${x}-${y}`}
          cx={x * CELL + CELL / 2}
          cy={y * CELL + CELL / 2}
          r={0.7}
          style={{ fill: "var(--border)" }}
        />
      ))}
      <circle
        cx={12 * CELL + CELL / 2}
        cy={3 * CELL + CELL / 2}
        r={3}
        style={{ fill: "var(--accent)" }}
      />
      {rest.map(([x, y]) => (
        <rect
          key={`body-${x}-${y}`}
          x={x * CELL + 1}
          y={y * CELL + 1}
          width={CELL - 2}
          height={CELL - 2}
          rx={2}
          style={{ fill: "var(--ink)" }}
        />
      ))}
      {head ? (
        <g transform={`translate(${head[0] * CELL} ${head[1] * CELL})`}>
          <rect
            x={1}
            y={1}
            width={CELL - 2}
            height={CELL - 2}
            rx={2}
            style={{ fill: "var(--primary)" }}
          />
          <circle cx={CELL / 2 + 2} cy={CELL / 2} r={1.2} style={{ fill: "var(--on-primary)" }} />
        </g>
      ) : null}
    </svg>
  );
}
