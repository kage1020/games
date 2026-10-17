import type { ReactNode } from "react";
import { cx } from "../internal.ts";
import { SectionHead } from "./basics.tsx";

export interface TableColumn {
  key: string;
  label: ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
  muted?: boolean;
  width?: number | string;
}

export interface TableProps {
  columns: TableColumn[];
  rows: (Record<string, ReactNode> & { id: string })[];
  caption?: ReactNode;
  className?: string;
}

/** 行と列のデータ。横の hairline だけで区切る */
export function Table({ columns, rows, caption, className }: TableProps) {
  return (
    <div className={cx("kg-table-wrap", className)}>
      <table className="kg-table">
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={{ textAlign: column.align ?? "left", width: column.width }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={column.mono ? "is-mono" : column.muted ? "is-muted" : undefined}
                  style={{ textAlign: column.align ?? "left" }}
                >
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  /** 前回との差。↑ ↓ の記号と数で示し、色を付けない */
  delta?: number;
  deltaLabel?: string;
  size?: "md" | "lg";
  className?: string;
}

/** 数字ひとつとその名前。数字は等幅 */
export function Stat({ label, value, unit, delta, deltaLabel, size, className }: StatProps) {
  return (
    <div className={cx("kg-stat", size === "lg" && "is-lg", className)}>
      <span className="kg-stat-label">{label}</span>
      <span className="kg-stat-value">
        {value}
        {unit ? <span className="kg-stat-unit">{unit}</span> : null}
      </span>
      {delta != null && delta !== 0 ? (
        <span className="kg-stat-delta">
          {`${delta > 0 ? "↑" : "↓"} ${Math.abs(delta)}${deltaLabel ? ` ${deltaLabel}` : ""}`}
        </span>
      ) : null}
    </div>
  );
}

export interface RankingRow {
  rank: number | string;
  name: ReactNode;
  score: ReactNode;
  me?: boolean;
}

export interface RankingProps {
  rows: RankingRow[];
  me?: Omit<RankingRow, "me"> | null;
  title?: ReactNode;
  aside?: ReactNode;
  className?: string;
  children?: ReactNode;
}

function RankRow({ row }: { row: RankingRow }) {
  return (
    <li className={cx("kg-rank-row", row.me && "is-me")} aria-current={row.me ? true : undefined}>
      <span className="kg-rank-rank">{row.rank}</span>
      <span className="kg-rank-name">
        {row.name}
        {row.me ? <span className="kg-badge">あなた</span> : null}
      </span>
      <span className="kg-rank-score">{row.score}</span>
    </li>
  );
}

/** 順位の一覧。圏外でも自分の行を下に固定して出す。children は行の代わりに出す（読み込み中・空など） */
export function Ranking({ rows, me, title, aside, className, children }: RankingProps) {
  const mine = me && !rows.some((row) => row.me) ? me : null;
  return (
    <div className={cx("kg-rank", className)}>
      {title ? (
        <SectionHead as="h3" aside={aside}>
          {title}
        </SectionHead>
      ) : null}
      {children ?? (
        <ol className="kg-rank-list">
          {rows.map((row) => (
            <RankRow key={`${row.rank}-${String(row.name)}`} row={row} />
          ))}
          {mine ? (
            <>
              <li className="kg-rank-gap" aria-hidden="true">
                ⋯
              </li>
              <RankRow row={{ ...mine, me: true }} />
            </>
          ) : null}
        </ol>
      )}
    </div>
  );
}
