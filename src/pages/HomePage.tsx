import { useState } from "react";
import { useGames } from "@/app/games-context.tsx";
import { pageTitle, SITE_TAGLINE } from "@/app/site.ts";
import { ContentCard, Gallery, Segmented } from "@/design-system/index.ts";
import { getModeRecord } from "@/platform/records/records.ts";
import { recordsStore } from "@/platform/records/store.ts";
import { selectedMode, settingsStore } from "@/platform/settings.ts";
import { useStore } from "@/platform/store.ts";
import type { GameDefinition, Genre } from "@/sdk/types.ts";

type Filter = "all" | Genre;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "パズル", label: "パズル" },
  { value: "アクション", label: "アクション" },
  { value: "脳トレ", label: "脳トレ" },
];

export function HomePage() {
  const games = useGames();
  const settings = useStore(settingsStore);
  const records = useStore(recordsStore);
  const [filter, setFilter] = useState<Filter>("all");

  const visible = games
    .filter((game) => filter === "all" || game.genre === filter)
    .map((game, order) => ({ game, order, favorite: settings.favorites.includes(game.id) }))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.order - b.order);

  const meta = (game: GameDefinition) => {
    const mode = selectedMode(settings, game);
    const best = getModeRecord(records, game.id, mode).best;
    const last = best === null ? game.duration : `ベスト ${game.formatScore(best)}`;
    return `${game.genre} · ${game.players} · ${last}`;
  };

  return (
    <main className="page home">
      <title>{pageTitle()}</title>
      <div className="home-head">
        <div className="home-lead">
          <h1 className="figure">{visible.length} つのゲーム</h1>
          <p className="small home-desc">{SITE_TAGLINE}</p>
        </div>
        <Segmented
          label="種類"
          options={FILTERS}
          value={filter}
          onChange={(value) => setFilter(value as Filter)}
        />
      </div>
      <Gallery min={260} className="home-gallery">
        {visible.map(({ game, favorite }) => (
          <ContentCard
            key={game.id}
            href={`/${game.id}`}
            title={game.title}
            description={game.summary}
            meta={meta(game)}
            badge={favorite ? "お気に入り" : undefined}
            thumb={<game.Thumb />}
          />
        ))}
      </Gallery>
    </main>
  );
}
