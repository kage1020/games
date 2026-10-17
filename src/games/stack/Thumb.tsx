const ROW = 10;
const GROUND = 82;

/** 下の段から [左端, 幅]。上ほど切り落とされて細くなる */
const BLOCKS = [
  [56, 48],
  [58, 46],
  [58, 46],
  [62, 42],
  [62, 40],
  [66, 36],
].map(([x = 0, width = 0], level) => ({ x, width, level, y: GROUND - (level + 1) * ROW }));

/** スタックの画面をそのまま縮めたもの */
export function Thumb() {
  return (
    <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width={160} height={90} style={{ fill: "var(--bg)" }} />
      <line x1={0} x2={160} y1={GROUND} y2={GROUND} style={{ stroke: "var(--line)" }} />
      {BLOCKS.map((block) => (
        <rect
          key={block.y}
          x={block.x}
          y={block.y + 0.5}
          width={block.width}
          height={ROW - 1}
          rx={1.5}
          style={{ fill: block.level === 0 ? "var(--border)" : "var(--ink)" }}
        />
      ))}
      <rect
        x={88}
        y={GROUND - (BLOCKS.length + 1) * ROW + 0.5}
        width={36}
        height={ROW - 1}
        rx={1.5}
        style={{ fill: "var(--accent)" }}
      />
    </svg>
  );
}
