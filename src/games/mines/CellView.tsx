export const CELL = 100;
export const LONG_PRESS = 300;
export const LOST_PAUSE = 1400;

function Flag() {
  return (
    <g>
      <path d="M40 24 L72 37 L40 50 Z" style={{ fill: "var(--ink)" }} />
      <path
        d="M40 24 V76 M28 76 H56"
        style={{ fill: "none", stroke: "var(--ink)", strokeWidth: 6, strokeLinecap: "round" }}
      />
    </g>
  );
}

export interface CellViewProps {
  /** 左上の位置（viewBox の単位） */
  x: number;
  y: number;
  open: boolean;
  /** 周りの地雷の数。開いたマスだけ使う */
  count: number;
  flagged: boolean;
  /** 終わったあとに見せる地雷。exploded は踏んだ地雷 */
  mine: "hidden" | "shown" | "exploded";
  wrongFlag: boolean;
  cursor: boolean;
}

/** 初級・中級・無限で共通の 1 マスの描き方 */
export function CellView({ x, y, open, count, flagged, mine, wrongFlag, cursor }: CellViewProps) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {open ? (
        count > 0 ? (
          <text
            x={CELL / 2}
            y={CELL / 2}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fill: "var(--ink)", font: "600 44px var(--font-mono)" }}
          >
            {count}
          </text>
        ) : (
          <circle cx={CELL / 2} cy={CELL / 2} r={3} style={{ fill: "var(--border)" }} />
        )
      ) : mine !== "hidden" ? (
        <circle
          cx={CELL / 2}
          cy={CELL / 2}
          r={mine === "exploded" ? 26 : 20}
          style={{ fill: mine === "exploded" ? "var(--danger)" : "var(--ink)" }}
        />
      ) : (
        <>
          <rect
            x={4}
            y={4}
            width={CELL - 8}
            height={CELL - 8}
            rx={6}
            style={{ fill: "var(--fill)", stroke: "var(--line)", strokeWidth: 1 }}
            vectorEffect="non-scaling-stroke"
          />
          {flagged ? <Flag /> : null}
          {wrongFlag ? (
            <path
              d="M20 20 L80 80 M80 20 L20 80"
              style={{ stroke: "var(--ink)", strokeWidth: 5, strokeLinecap: "round" }}
            />
          ) : null}
        </>
      )}
      {cursor ? (
        <rect
          x={2}
          y={2}
          width={CELL - 4}
          height={CELL - 4}
          rx={8}
          style={{ fill: "none", stroke: "var(--focus)", strokeWidth: 2 }}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </g>
  );
}

/**
 * 長押しで旗になるまでの進み具合。指で隠れないよう、押したマスより大きな円で囲み、
 * ほかのマスより後に描いて上に重ねる。x と y は押したマスの左上（viewBox の単位）
 */
export function PressRing({ x, y }: { x: number; y: number }) {
  const cx = x + CELL / 2;
  const cy = y + CELL / 2;
  return (
    <circle
      className="mines-press"
      cx={cx}
      cy={cy}
      r={CELL * 1.25}
      pathLength={100}
      transform={`rotate(-90 ${cx} ${cy})`}
      style={{
        fill: "none",
        stroke: "var(--accent)",
        strokeWidth: 10,
        strokeLinecap: "round",
        animationDuration: `${LONG_PRESS}ms`,
        pointerEvents: "none",
      }}
    />
  );
}
