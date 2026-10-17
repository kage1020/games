import type { Period } from "@shared/period.ts";
import { useState } from "react";
import { Button, EmptyState, Notice, Ranking, Segmented, Skeleton } from "@/design-system/index.ts";
import { useRanking } from "@/platform/ranking/useRanking.ts";
import { settingsStore } from "@/platform/settings.ts";
import { useStore } from "@/platform/store.ts";
import { scoreFormat } from "@/sdk/score.ts";
import type { GameDefinition } from "@/sdk/types.ts";

const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "今日" },
  { value: "week", label: "今週" },
  { value: "all", label: "すべて" },
];

export function RankingPanel({
  game,
  mode,
  version,
}: {
  game: GameDefinition;
  mode: string;
  version: number;
}) {
  const [period, setPeriod] = useState<Period>("week");
  const ranking = useRanking(game.id, mode, period, version);
  const { name } = useStore(settingsStore);
  const { format } = scoreFormat(game, mode);
  const aside = (
    <Segmented
      label="期間"
      options={PERIODS}
      value={period}
      onChange={(value) => setPeriod(value as Period)}
    />
  );

  let body = null;
  if (ranking.status === "error") {
    body = (
      <div className="ranking-message">
        <Notice tone="danger">
          ランキングを読み込めなかった。通信が戻ったら、読み込み直してほしい。
        </Notice>
        <Button variant="link" onClick={ranking.reload}>
          読み込み直す
        </Button>
      </div>
    );
  } else if (ranking.data === null) {
    body = <Skeleton lines={3} height={20} className="ranking-message" />;
  } else if (ranking.data.total === 0) {
    body = <EmptyState title="まだ記録がない。" description="最初の記録になる。" />;
  }

  const data = ranking.data;
  const shownName = name ?? data?.rows.find((row) => row.me)?.name ?? data?.me?.name ?? "guest";
  return (
    <section className="play-ranking" aria-busy={ranking.status === "loading"}>
      <Ranking
        title="ランキング"
        aside={aside}
        rows={(data?.rows ?? []).map((row) => ({
          rank: row.rank,
          name: row.name,
          score: format(row.score),
          me: row.me,
        }))}
        me={data?.me ? { ...data.me, score: format(data.me.score) } : null}
      >
        {body}
      </Ranking>
      <p className="meta ranking-name">
        ランキングでの名前は「{shownName}」。
        <Button variant="link" href="/settings#name" className="ranking-name-link">
          変える
        </Button>
      </p>
    </section>
  );
}
