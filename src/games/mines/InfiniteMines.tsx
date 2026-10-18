import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { formatDuration, formatNumber } from "@/platform/format.ts";
import { useSaveOnLeave } from "@/sdk/hooks.ts";
import type { GameProps } from "@/sdk/types.ts";
import { LOST_PAUSE } from "./CellView.tsx";
import { InfiniteBoard } from "./InfiniteBoard.tsx";
import {
  canToggleFlag,
  createInfinite,
  type InfiniteState,
  reveal,
  tick,
  toggleFlag,
} from "./infinite.ts";
import { restoreProgress, saveProgress } from "./infiniteSave.ts";
import { type BoardRules, freshProgress, useInfiniteView } from "./useInfiniteView.ts";

const RULES: BoardRules<InfiniteState> = {
  reveal,
  toggleFlag,
  canToggleFlag,
  tick,
  isPlaying: (state) => state.phase === "playing",
  isOver: (state) => state.phase === "lost",
};

function describe(game: InfiniteState): string {
  switch (game.phase) {
    case "ready":
      return "マスを選んで開く";
    case "playing":
      return `開いたマス ${formatNumber(game.revealed.size)}`;
    case "lost":
      return "地雷を踏んだ";
  }
}

export function InfiniteMines({ seed, paused, sound, saved, onHud, onFinish, onSave }: GameProps) {
  const prefix = `mines-${useId().replace(/[^\w-]/g, "")}`;
  // 続きから始めるときは保存したところから。読み戻せなければはじめから
  const [resumed] = useState(() => (saved === null ? null : restoreProgress(saved)));
  const view = useInfiniteView(RULES, () => resumed ?? freshProgress(createInfinite(seed)), {
    paused,
    sound,
  });
  const { game, center, span, cursor } = view;
  const over = game.phase === "lost";

  const openedText = formatNumber(game.revealed.size);
  const timeText = formatDuration(game.elapsed);
  const reportHud = useEffectEvent(onHud);
  useEffect(() => {
    reportHud([
      { label: "開いたマス", value: openedText },
      { label: "時間", value: timeText },
    ]);
  }, [openedText, timeText]);

  const opened = game.revealed.size;
  // 続きから始めたときに鳴らさないよう、増えたときだけ鳴らす
  const lastOpened = useRef(opened);
  const onOpened = useEffectEvent((count: number) => {
    if (count > lastOpened.current && game.phase === "playing") sound.play("tap");
    lastOpened.current = count;
  });
  useEffect(() => {
    onOpened(opened);
  }, [opened]);

  const onPhase = useEffectEvent((phase: InfiniteState["phase"]) => {
    if (phase !== "lost") return;
    sound.play("bad");
    // 結果が出るまでの間に画面を離れても、終わった回を続きとして残さない
    onSave(null);
  });
  useEffect(() => {
    onPhase(game.phase);
  }, [game.phase]);

  const finish = useEffectEvent(() =>
    onFinish({
      score: game.revealed.size,
      stats: [{ label: "時間", value: formatDuration(game.elapsed) }],
    }),
  );
  useEffect(() => {
    if (paused || !over) return;
    const timer = setTimeout(finish, LOST_PAUSE);
    return () => clearTimeout(timer);
  }, [paused, over]);

  const dropUnreadable = useEffectEvent(() => {
    if (saved !== null && resumed === null) onSave(null);
  });
  useEffect(() => {
    dropUnreadable();
  }, []);

  const save = () => {
    if (game.phase !== "playing") return;
    onSave({
      state: saveProgress({ game, center, span, cursor }),
      summary: [
        { label: "開いたマス", value: openedText },
        { label: "時間", value: timeText },
      ],
    });
  };
  useSaveOnLeave(save, paused);
  // 開いたマスと旗が変わるたびに保存する。時間が進むだけでは保存しない
  const saveChange = useEffectEvent(save);
  const { revealed, flagged } = game;
  useEffect(() => {
    if (revealed.size > 0 || flagged.size > 0) saveChange();
  }, [revealed, flagged]);

  return (
    <svg className="game-svg" role="img" aria-label={describe(game)} {...view.svg}>
      <InfiniteBoard
        prefix={prefix}
        revealed={game.revealed}
        flagged={game.flagged}
        seed={game.seed}
        start={game.start}
        over={over}
        exploded={game.exploded}
        {...view.area}
        cursor={view.shownCursor}
        pressing={view.pressing}
      />
    </svg>
  );
}
