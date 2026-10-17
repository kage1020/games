import { EmptyState, SectionHead } from "@/design-system/index.ts";
import { formatPlayedAt } from "@/platform/format.ts";
import type { ModeRecord } from "@/platform/records/records.ts";
import type { GameDefinition } from "@/sdk/types.ts";

export function RecentPlays({ game, record }: { game: GameDefinition; record: ModeRecord }) {
  const now = Date.now();
  return (
    <section className="play-recent" aria-labelledby={`${game.id}-recent`}>
      <SectionHead as="h3" id={`${game.id}-recent`} count={record.recent.length}>
        最近の記録
      </SectionHead>
      {record.recent.length === 0 ? (
        <EmptyState title="まだ遊んでいない。" description="遊ぶと、ここに 10 回分まで残る。" />
      ) : (
        <ol className="recent-list">
          {record.recent.map((play) => (
            <li key={play.at} className="recent-row">
              <span className="recent-when">{formatPlayedAt(play.at, now)}</span>
              <span className="recent-score">{game.formatScore(play.score)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
