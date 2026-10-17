import { memo, type ReactNode } from "react";
import { CELL, Flag, PressRing } from "./CellView.tsx";
import { type Cell, cellKey, isMine } from "./infinite.ts";

const HALF = CELL / 2;
const DOT = 3;

export interface InfiniteBoardProps {
  /** pattern と旗の id の頭。ページ内で重ならないようにする */
  prefix: string;
  revealed: ReadonlyMap<string, number>;
  flagged: ReadonlySet<string>;
  seed: number;
  start: Cell | null;
  over: boolean;
  exploded: Cell | null;
  camera: Cell;
  span: number;
  /** キー操作のカーソル。出さないときは null */
  cursor: Cell | null;
  pressing: Cell | null;
}

/**
 * 画面に映る範囲だけを描く。閉じたマスは模様 1 つで敷き、開いたマスは 1 本の path で上から塗る。
 * 要素を作るのは数字・旗と、終わったあとの地雷だけ
 */
export const InfiniteBoard = memo(function InfiniteBoard({
  prefix,
  revealed,
  flagged,
  seed,
  start,
  over,
  exploded,
  camera,
  span,
  cursor,
  pressing,
}: InfiniteBoardProps) {
  const opened: string[] = [];
  const dots: string[] = [];
  const marks: ReactNode[] = [];
  const flags: ReactNode[] = [];
  for (let y = Math.floor(camera.y); y < camera.y + span; y++) {
    for (let x = Math.floor(camera.x); x < camera.x + span; x++) {
      const key = cellKey(x, y);
      const px = x * CELL;
      const py = y * CELL;
      const count = revealed.get(key);
      if (count !== undefined) {
        opened.push(`M${px} ${py}h${CELL}v${CELL}h${-CELL}z`);
        if (count === 0) {
          dots.push(
            `M${px + HALF - DOT} ${py + HALF}a${DOT} ${DOT} 0 1 0 ${DOT * 2} 0a${DOT} ${DOT} 0 1 0 ${-DOT * 2} 0`,
          );
        } else {
          marks.push(
            <text
              key={key}
              x={px + HALF}
              y={py + HALF}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ fill: "var(--ink)", font: "600 44px var(--font-mono)" }}
            >
              {count}
            </text>,
          );
        }
        continue;
      }
      const flag = flagged.has(key);
      const mine = over && isMine({ seed, start }, x, y);
      if (flag) {
        flags.push(<use key={key} className="mines-flag" href={`#${prefix}-flag`} x={px} y={py} />);
      }
      if (mine && !flag) {
        const blown = exploded?.x === x && exploded.y === y;
        opened.push(`M${px} ${py}h${CELL}v${CELL}h${-CELL}z`);
        marks.push(
          <circle
            key={key}
            cx={px + HALF}
            cy={py + HALF}
            r={blown ? 26 : 20}
            style={{ fill: blown ? "var(--danger)" : "var(--ink)" }}
          />,
        );
      } else if (over && flag && !mine) {
        flags.push(
          <path
            key={`${key}-wrong`}
            d={`M${px + 20} ${py + 20}L${px + 80} ${py + 80}M${px + 80} ${py + 20}L${px + 20} ${py + 80}`}
            style={{ stroke: "var(--ink)", strokeWidth: 5, strokeLinecap: "round" }}
          />,
        );
      }
    }
  }

  const left = camera.x * CELL;
  const top = camera.y * CELL;
  const extent = span * CELL;
  return (
    <>
      <defs>
        <pattern id={`${prefix}-closed`} width={CELL} height={CELL} patternUnits="userSpaceOnUse">
          <rect width={CELL} height={CELL} style={{ fill: "var(--bg)" }} />
          <rect
            x={4}
            y={4}
            width={CELL - 8}
            height={CELL - 8}
            rx={6}
            style={{ fill: "var(--fill)", stroke: "var(--line)", strokeWidth: 2 }}
          />
        </pattern>
        <g id={`${prefix}-flag`}>
          <Flag />
        </g>
      </defs>
      <rect
        x={left}
        y={top}
        width={extent}
        height={extent}
        style={{ fill: `url(#${prefix}-closed)` }}
      />
      {opened.length > 0 ? <path d={opened.join("")} style={{ fill: "var(--bg)" }} /> : null}
      {dots.length > 0 ? <path d={dots.join("")} style={{ fill: "var(--border)" }} /> : null}
      {marks}
      {flags}
      {cursor ? (
        <rect
          x={cursor.x * CELL + 2}
          y={cursor.y * CELL + 2}
          width={CELL - 4}
          height={CELL - 4}
          rx={8}
          style={{ fill: "none", stroke: "var(--focus)", strokeWidth: 2 }}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {pressing && !over ? <PressRing x={pressing.x * CELL} y={pressing.y * CELL} /> : null}
    </>
  );
});
