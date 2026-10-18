import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { Button } from "@/design-system/index.ts";
import { formatDuration, formatNumber } from "@/platform/format.ts";
import { useSaveOnLeave } from "@/sdk/hooks.ts";
import type { GameProps, HudItem } from "@/sdk/types.ts";
import {
  canToggleFlag,
  createFrontier,
  endFrontier,
  type FrontierState,
  reveal,
  tick,
  toggleFlag,
} from "./frontier.ts";
import { InfiniteBoard } from "./InfiniteBoard.tsx";
import { restoreFrontier, saveFrontier } from "./infiniteSave.ts";
import { type BoardRules, freshProgress, useInfiniteView } from "./useInfiniteView.ts";

const RULES: BoardRules<FrontierState> = {
  reveal,
  toggleFlag,
  canToggleFlag,
  tick,
  isPlaying: (state) => state.phase === "playing",
  isOver: (state) => state.phase === "ended",
};

function describe(game: FrontierState): string {
  switch (game.phase) {
    case "ready":
      return "マスを選んで開く";
    case "playing":
      return `確保した区画 ${formatNumber(game.secured.size)}、踏んだ地雷 ${formatNumber(game.hits.size)}`;
    case "ended":
      return "ここで終えた";
  }
}

/** HUD と「続きから」に出す途中の様子 */
const progressItems = (secured: string, hits: string, time: string): HudItem[] => [
  { label: "区画", value: secured },
  { label: "踏んだ地雷", value: hits },
  { label: "時間", value: time },
];

export function FrontierMines({ seed, paused, sound, saved, onHud, onFinish, onSave }: GameProps) {
  const prefix = `mines-${useId().replace(/[^\w-]/g, "")}`;
  // 続きから始めるときは保存したところから。読み戻せなければはじめから
  const [resumed] = useState(() => (saved === null ? null : restoreFrontier(saved)));
  // 「ここで終える」を確かめている間は、一時停止と同じく盤面を止める
  const [confirming, setConfirming] = useState(false);
  const view = useInfiniteView(RULES, () => resumed ?? freshProgress(createFrontier(seed)), {
    paused: paused || confirming,
    sound,
  });
  const { game, center, span, cursor } = view;
  const { revealed, flagged, hits, secured } = game;

  const securedText = formatNumber(secured.size);
  const hitsText = formatNumber(hits.size);
  const timeText = formatDuration(game.elapsed);
  const reportHud = useEffectEvent(onHud);
  useEffect(() => {
    reportHud(progressItems(securedText, hitsText, timeText));
  }, [securedText, hitsText, timeText]);

  // 続きから始めたときに鳴らさないよう、増えたときだけ鳴らす。重なったら踏んだ・確保・開いたの順に 1 つだけ
  const counts = useRef({ opened: revealed.size, secured: secured.size, hits: hits.size });
  const onCounts = useEffectEvent((opened: number, securedCount: number, hitCount: number) => {
    const before = counts.current;
    counts.current = { opened, secured: securedCount, hits: hitCount };
    if (hitCount > before.hits) sound.play("bad");
    else if (securedCount > before.secured) sound.play("good");
    else if (opened > before.opened) sound.play("tap");
  });
  useEffect(() => {
    onCounts(revealed.size, secured.size, hits.size);
  }, [revealed.size, secured.size, hits.size]);

  const finish = useEffectEvent(() => {
    onSave(null);
    const stats = [
      { label: "踏んだ地雷", value: hitsText },
      { label: "開いたマス", value: formatNumber(revealed.size) },
      { label: "時間", value: timeText },
    ];
    onFinish(
      secured.size > 0
        ? { score: secured.size, stats }
        : { score: null, stats, note: "確保した区画がない。記録は残らない。" },
    );
  });
  useEffect(() => {
    if (game.phase === "ended") finish();
  }, [game.phase]);

  const dropUnreadable = useEffectEvent(() => {
    if (saved !== null && resumed === null) onSave(null);
  });
  useEffect(() => {
    dropUnreadable();
  }, []);

  const save = () => {
    if (game.phase !== "playing") return;
    onSave({
      state: saveFrontier({ game, center, span, cursor }),
      summary: progressItems(securedText, hitsText, timeText),
    });
  };
  useSaveOnLeave(save, paused);
  // 開いたマス・旗・踏んだ地雷が変わるたびに保存する。時間が進むだけでは保存しない
  const saveChange = useEffectEvent(save);
  useEffect(() => {
    if (revealed.size + flagged.size + hits.size > 0) saveChange();
  }, [revealed, flagged, hits]);

  const end = () => {
    setConfirming(false);
    view.update(endFrontier);
  };

  return (
    <div className="mines-frontier">
      <svg className="game-svg" role="img" aria-label={describe(game)} {...view.svg}>
        <InfiniteBoard
          prefix={prefix}
          revealed={revealed}
          flagged={flagged}
          seed={game.seed}
          start={game.start}
          over={false}
          exploded={null}
          hits={hits}
          secured={secured}
          lost={game.lost}
          {...view.area}
          cursor={view.shownCursor}
          pressing={view.pressing}
        />
      </svg>
      {game.phase === "playing" && !confirming ? (
        <div className="mines-end">
          <Button size="sm" onClick={() => setConfirming(true)}>
            ここで終える
          </Button>
        </div>
      ) : null}
      {confirming ? (
        <div className="kg-pause" role="dialog" aria-modal="true" aria-label="ここで終える">
          <p className="kg-pause-title">ここで終える？</p>
          <p className="kg-pause-hint">
            {secured.size > 0
              ? `確保した区画 ${securedText} を記録する。この盤面は消える。`
              : "確保した区画がないので、記録は残らない。この盤面は消える。"}
          </p>
          <div className="kg-pause-actions">
            <Button variant="primary" onClick={() => setConfirming(false)} autoFocus>
              続ける
            </Button>
            <Button onClick={end}>終える</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
