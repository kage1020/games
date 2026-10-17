/** 反応速度の 2 つの場面（待つ・押す）を並べたもの */
export function Thumb() {
  return (
    <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width={160} height={90} style={{ fill: "var(--bg)" }} />
      <rect x={12} y={12} width={64} height={66} rx={4} style={{ fill: "var(--bg-subtle)" }} />
      <circle
        cx={44}
        cy={38}
        r={12}
        style={{ fill: "none", stroke: "var(--border)", strokeWidth: 1.5 }}
      />
      <text
        x={44}
        y={64}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fill: "var(--ink-muted)", font: "500 8px var(--font-sans)" }}
      >
        待つ
      </text>
      <rect x={84} y={12} width={64} height={66} rx={4} style={{ fill: "var(--accent)" }} />
      <circle cx={116} cy={38} r={12} style={{ fill: "var(--bg)" }} />
      <text
        x={116}
        y={64}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fill: "var(--bg)", font: "600 8px var(--font-sans)" }}
      >
        押す
      </text>
    </svg>
  );
}
