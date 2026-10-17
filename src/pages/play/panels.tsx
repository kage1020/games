import type { RankPosition } from "@shared/api.ts";
import { Play } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button, Result, Stat } from "@/design-system/index.ts";
import type { RecordOutcome } from "@/platform/records/records.ts";
import { scoreFormat } from "@/sdk/score.ts";
import type { GameDefinition, GameResult } from "@/sdk/types.ts";
import { describeResult } from "./session.ts";

function useInitialFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}

export function StartPanel({ game, onStart }: { game: GameDefinition; onStart: () => void }) {
  const button = useInitialFocus<HTMLButtonElement>();
  return (
    <div className="play-panel">
      <p className="title">{game.title}</p>
      <p className="small play-panel-text">{game.summary}</p>
      <Button ref={button} variant="primary" icon={<Play />} onClick={onStart}>
        はじめる
      </Button>
      <p className="meta play-panel-text">Enter で始める</p>
    </div>
  );
}

export interface FinishSummary {
  /** その回を始めたときのモード */
  mode: string;
  result: GameResult;
  outcome: Pick<RecordOutcome, "isFirst" | "isBest" | "isTie" | "previousBest">;
  ranks: Record<"today" | "week" | "all", RankPosition> | null;
}

export function ResultPanel({
  game,
  summary,
  onAgain,
  onShare,
}: {
  game: GameDefinition;
  summary: FinishSummary;
  onAgain: () => void;
  onShare: () => void;
}) {
  const again = useInitialFocus<HTMLButtonElement>();
  const { result, outcome, ranks } = summary;
  const format = scoreFormat(game, summary.mode);
  const { note, celebrate } = describeResult(result.score, outcome, format.format, result.note);
  const best =
    result.score !== null && (outcome.isBest || outcome.isFirst)
      ? result.score
      : outcome.previousBest;
  const delta =
    outcome.isBest && !outcome.isFirst && result.score !== null && outcome.previousBest !== null
      ? (format.delta?.(result.score - outcome.previousBest) ?? {
          value: result.score - outcome.previousBest,
        })
      : null;
  const week = ranks?.week;

  return (
    <div className="play-panel play-result">
      <Result
        label={format.label}
        value={result.score ?? undefined}
        score={result.score === null ? "—" : undefined}
        format={format.format}
        celebrate={celebrate}
        note={note}
        stats={
          <>
            {best !== null ? (
              <Stat
                label="自己ベスト"
                value={format.format(best)}
                delta={delta?.value}
                deltaLabel={delta?.unit}
              />
            ) : null}
            {week && week.rank > 0 ? (
              <Stat label="今週の順位" value={String(week.rank)} unit={`位 / ${week.total}人`} />
            ) : null}
            {result.stats?.map((item) => (
              <Stat key={item.label} label={item.label} value={item.value} unit={item.unit} />
            ))}
          </>
        }
        actions={
          <>
            <Button ref={again} variant="primary" icon={<Play />} onClick={onAgain}>
              もう一度
            </Button>
            <Button href="/">一覧へ</Button>
            <Button variant="link" onClick={onShare}>
              結果を共有
            </Button>
          </>
        }
      />
    </div>
  );
}
