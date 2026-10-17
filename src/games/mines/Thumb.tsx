const COLS = 9;
const ROWS = 5;
const CELL = 16;
const LEFT = (160 - CELL * COLS) / 2;
const TOP = (90 - CELL * ROWS) / 2;

/** 行ごとの見え方。. は開いた 0、数字は開いた数、# は閉じたマス、F は旗 */
const LAYOUT = ["...1##1..", "..12F#21.", ".13##F#1.", ".1F##3#21", ".1######F"];

/** 地雷の盤面をそのまま縮めたもの */
export function Thumb() {
  const cells = LAYOUT.flatMap((row, y) =>
    Array.from(row, (mark, x) => ({ mark, x: LEFT + x * CELL, y: TOP + y * CELL })),
  );
  return (
    <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width={160} height={90} style={{ fill: "var(--bg)" }} />
      {cells.map(({ mark, x, y }) => (
        <g key={`cell-${x}-${y}`} transform={`translate(${x} ${y})`}>
          {mark === "." ? (
            <circle cx={CELL / 2} cy={CELL / 2} r={0.6} style={{ fill: "var(--border)" }} />
          ) : mark === "#" || mark === "F" ? (
            <>
              <rect
                x={0.75}
                y={0.75}
                width={CELL - 1.5}
                height={CELL - 1.5}
                rx={1.5}
                style={{ fill: "var(--fill)", stroke: "var(--line)", strokeWidth: 0.5 }}
              />
              {mark === "F" ? (
                <g transform={`scale(${CELL / 100})`}>
                  <path d="M40 24 L72 37 L40 50 Z" style={{ fill: "var(--ink)" }} />
                  <path
                    d="M40 24 V76 M28 76 H56"
                    style={{
                      fill: "none",
                      stroke: "var(--ink)",
                      strokeWidth: 6,
                      strokeLinecap: "round",
                    }}
                  />
                </g>
              ) : null}
            </>
          ) : (
            <text
              x={CELL / 2}
              y={CELL / 2 + 0.4}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ fill: "var(--ink)", font: "600 8px var(--font-mono)" }}
            >
              {mark}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
