import { memo, type ReactNode } from "react";
import { CELL, Flag, PressRing } from "./CellView.tsx";
import { SECTOR, sectorAt } from "./frontier.ts";
import { type Cell, cellKey, isMine } from "./infinite.ts";

const HALF = CELL / 2;
const DOT = 3;
/** 区画を確保したマスに重ねる accent の濃さ */
const SECURED_OPACITY = 0.14;

const square = (px: number, py: number) => `M${px} ${py}h${CELL}v${CELL}h${-CELL}z`;

/** from から from + length までにある、step の倍数 */
function multiples(from: number, length: number, step: number): number[] {
  const result: number[] = [];
  for (let at = Math.ceil(from / step) * step; at <= from + length; at += step) result.push(at);
  return result;
}

export interface InfiniteBoardProps {
  /** pattern と旗の id の頭。ページ内で重ならないようにする */
  prefix: string;
  revealed: ReadonlyMap<string, number>;
  flagged: ReadonlySet<string>;
  seed: number;
  start: Cell | null;
  over: boolean;
  exploded: Cell | null;
  /** 踏んだ地雷（開拓）。開いたマスの上に地雷として描く */
  hits?: ReadonlySet<string>;
  /** 確保した区画と確保できなくなった区画（開拓）。渡すと区画の境目も描く */
  secured?: ReadonlySet<string>;
  lost?: ReadonlySet<string>;
  /** 映す範囲の左上（マスの単位、小数もある） */
  left: number;
  top: number;
  /** 映す範囲の縦横のマスの数 */
  width: number;
  height: number;
  /** キー操作のカーソル。出さないときは null */
  cursor: Cell | null;
  pressing: Cell | null;
}

/**
 * 画面に映る範囲だけを描く。閉じたマスは模様 1 つで敷き、開いたマスは 1 本の path で上から塗る。
 * 要素を作るのは数字・旗と、踏んだ地雷・終わったあとの地雷だけ。区画は色ごとに 1 本の path で塗る
 */
export const InfiniteBoard = memo(function InfiniteBoard({
  prefix,
  revealed,
  flagged,
  seed,
  start,
  over,
  exploded,
  hits,
  secured,
  lost,
  left,
  top,
  width,
  height,
  cursor,
  pressing,
}: InfiniteBoardProps) {
  const opened: string[] = [];
  const securedCells: string[] = [];
  const lostCells: string[] = [];
  const dots: string[] = [];
  const marks: ReactNode[] = [];
  const flags: ReactNode[] = [];
  for (let y = Math.floor(top); y < top + height; y++) {
    for (let x = Math.floor(left); x < left + width; x++) {
      const key = cellKey(x, y);
      const px = x * CELL;
      const py = y * CELL;
      const count = revealed.get(key);
      const hit = hits?.has(key) === true;
      if (count !== undefined || hit) {
        opened.push(square(px, py));
        const sector = secured || lost ? sectorAt(x, y) : null;
        if (sector !== null && secured?.has(sector)) securedCells.push(square(px, py));
        if (sector !== null && lost?.has(sector)) lostCells.push(square(px, py));
      }
      if (hit) {
        marks.push(
          <circle
            key={key}
            className="mines-hit"
            cx={px + HALF}
            cy={py + HALF}
            r={26}
            style={{ fill: "var(--danger)" }}
          />,
        );
        continue;
      }
      if (count !== undefined) {
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
        opened.push(square(px, py));
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

  const borders =
    secured === undefined
      ? []
      : [
          ...multiples(left, width, SECTOR).map(
            (at) => `M${at * CELL} ${top * CELL}V${(top + height) * CELL}`,
          ),
          ...multiples(top, height, SECTOR).map(
            (at) => `M${left * CELL} ${at * CELL}H${(left + width) * CELL}`,
          ),
        ];

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
        x={left * CELL}
        y={top * CELL}
        width={width * CELL}
        height={height * CELL}
        style={{ fill: `url(#${prefix}-closed)` }}
      />
      {opened.length > 0 ? <path d={opened.join("")} style={{ fill: "var(--bg)" }} /> : null}
      {securedCells.length > 0 ? (
        <path
          className="mines-secured"
          d={securedCells.join("")}
          style={{ fill: "var(--accent)", fillOpacity: SECURED_OPACITY }}
        />
      ) : null}
      {lostCells.length > 0 ? (
        <path
          className="mines-lost"
          d={lostCells.join("")}
          style={{ fill: "var(--danger-soft)" }}
        />
      ) : null}
      {dots.length > 0 ? <path d={dots.join("")} style={{ fill: "var(--border)" }} /> : null}
      {marks}
      {flags}
      {borders.length > 0 ? (
        <path
          className="mines-sectors"
          d={borders.join("")}
          style={{ fill: "none", stroke: "var(--border)", strokeWidth: 1 }}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
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
