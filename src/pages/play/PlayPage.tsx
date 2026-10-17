import { isValidScore, scoreOrder } from "@shared/catalog.ts";
import { Heart, Volume2, VolumeX } from "lucide-react";
import {
  type CSSProperties,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router";
import { useGame } from "@/app/games-context.tsx";
import { pageTitle } from "@/app/site.ts";
import {
  Breadcrumb,
  Kbd,
  Segmented,
  Skeleton,
  Stage,
  Stat,
  Toggle,
  useReducedMotion,
} from "@/design-system/index.ts";
import { showNotice } from "@/platform/notices.tsx";
import { useApi } from "@/platform/ranking/context.tsx";
import { submitScore } from "@/platform/ranking/submit.ts";
import { getModeRecord, recordPlay } from "@/platform/records/records.ts";
import { recordsStore } from "@/platform/records/store.ts";
import { selectedMode, settingsStore, toggleFavorite } from "@/platform/settings.ts";
import { createSound } from "@/platform/sound.ts";
import { useStore } from "@/platform/store.ts";
import { randomSeed } from "@/sdk/rng.ts";
import type { GameDefinition, GameResult, HudItem } from "@/sdk/types.ts";
import { NotFoundPage } from "../NotFoundPage.tsx";
import { type FinishSummary, ResultPanel, StartPanel } from "./panels.tsx";
import { RankingPanel } from "./RankingPanel.tsx";
import { RecentPlays } from "./RecentPlays.tsx";
import { createSession, sessionReducer } from "./session.ts";

const RATIO = { wide: 16 / 9, square: 1, tall: 3 / 4 } as const;

export function PlayPage() {
  const { gameId } = useParams();
  const game = useGame(gameId);
  if (!game) return <NotFoundPage />;
  return <Play key={game.id} game={game} />;
}

function Play({ game }: { game: GameDefinition }) {
  const api = useApi();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const settings = useStore(settingsStore);
  const records = useStore(recordsStore);
  const mode = selectedMode(settings, game);
  const [session, dispatch] = useReducer(sessionReducer, game.timed, createSession);
  // 始めたときのモード。遊んでいる間に別のタブで変わっても、この回はこれで記録する
  const [runMode, setRunMode] = useState(mode);
  const [hud, setHud] = useState<HudItem[]>([]);
  const [summary, setSummary] = useState<FinishSummary | null>(null);
  const [rankingVersion, setRankingVersion] = useState(0);
  const screenRef = useRef<HTMLDivElement>(null);
  const seed = useMemo(() => (session.run > 0 ? randomSeed() : 0), [session.run]);
  const sound = useMemo(
    () =>
      createSound(() => {
        const current = settingsStore.get();
        return current.muted ? 0 : current.volume / 100;
      }),
    [],
  );

  const playing = session.status === "playing";
  const canPause = game.timed && playing;

  useEffect(() => {
    if (!canPause) return;
    const pause = () => dispatch({ type: "pause" });
    const onVisibility = () => {
      if (document.visibilityState === "hidden") pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", pause);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", pause);
    };
  }, [canPause]);

  useEffect(() => {
    if (session.status === "playing") screenRef.current?.focus({ preventScroll: true });
  }, [session.status]);

  // 遊んでいる間にマウスでほかのボタンを押しても、キー操作はゲームに戻す
  useEffect(() => {
    if (!playing) return;
    const refocus = () => screenRef.current?.focus({ preventScroll: true });
    const onClick = (event: MouseEvent) => {
      if (event.detail === 0) return;
      const target = event.target;
      if (!(target instanceof Element) || screenRef.current?.contains(target)) return;
      if (target.closest(".kg-stage-bar, a, input, textarea, select")) return;
      refocus();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("fullscreenchange", refocus);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("fullscreenchange", refocus);
    };
  }, [playing]);

  const start = () => {
    setHud([]);
    setSummary(null);
    setRunMode(mode);
    dispatch({ type: session.status === "ready" ? "start" : "restart" });
  };

  const changeMode = (next: string) => {
    settingsStore.set((current) => ({ ...current, modes: { ...current.modes, [game.id]: next } }));
    setHud([]);
    setSummary(null);
    dispatch({ type: "reset" });
  };

  const finish = useCallback(
    (result: GameResult) => {
      const at = Date.now();
      const outcome = recordPlay(recordsStore.get(), {
        game: game.id,
        mode: runMode,
        order: scoreOrder(game.id, runMode),
        score: result.score,
        at,
      });
      recordsStore.set(outcome.records);
      setSummary({ result, outcome, ranks: null });
      dispatch({ type: "finish", result });
      if (outcome.isBest && !outcome.isFirst) sound.play("clear");
      const score = result.score;
      if (score === null || !isValidScore(game.id, runMode, score)) return;
      void submitScore(api, { game: game.id, mode: runMode, score, at }).then((response) => {
        // 遅れて届いた前の回の応答は、いまの結果に書き込まない
        if (response) {
          setSummary((current) =>
            current?.result === result ? { ...current, ranks: response.ranks } : current,
          );
        }
        setRankingVersion((version) => version + 1);
      });
    },
    [api, game.id, runMode, sound],
  );

  const share = async () => {
    const result = summary?.result;
    if (!result || result.score === null) {
      showNotice({ message: "共有できる記録がない。" });
      return;
    }
    const url = `${window.location.origin}/${game.id}`;
    const text = `${game.title}で ${game.scoreLabel} ${game.formatScore(result.score)} を記録した。`;
    try {
      if (navigator.share) {
        await navigator.share({ text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      showNotice({ message: "結果をコピーした。" });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      showNotice({
        tone: "danger",
        message: "共有できなかった。もう一度押すか、画面の数字を写して伝えてほしい。",
      });
    }
  };

  const modeRecord = getModeRecord(records, game.id, mode);
  const favorite = settings.favorites.includes(game.id);

  let screen = null;
  if (session.status === "ready") {
    screen = <StartPanel game={game} onStart={start} />;
  } else if (session.status === "finished" && summary) {
    screen = (
      <ResultPanel game={game} summary={summary} onAgain={start} onShare={() => void share()} />
    );
  } else {
    screen = (
      <Suspense fallback={<Skeleton lines={1} height="100%" className="play-loading" />}>
        <game.Game
          key={session.run}
          mode={runMode}
          paused={session.status === "paused"}
          seed={seed}
          sound={sound}
          reducedMotion={reducedMotion}
          onHud={setHud}
          onFinish={finish}
        />
      </Suspense>
    );
  }

  const controls = [
    ...game.controls,
    ...(game.timed ? [{ keys: ["Esc"], text: "で一時停止" }] : []),
  ].map((hint) => (
    <span key={hint.text} className="play-hint">
      {hint.keys?.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
      <span>{hint.text}</span>
    </span>
  ));

  return (
    <main className="page play">
      <title>{pageTitle(game.title)}</title>
      <div className="play-main">
        <Breadcrumb
          className="play-crumb"
          items={[{ label: "一覧", href: "/" }, { label: game.title }]}
        />
        <Stage
          className="play-stage"
          style={{ "--ratio": RATIO[game.aspect] } as CSSProperties}
          title={game.title}
          aspect={game.aspect}
          hud={
            playing || session.status === "paused"
              ? hud.map((item) => (
                  <Stat key={item.label} label={item.label} value={item.value} unit={item.unit} />
                ))
              : null
          }
          controls={controls}
          paused={session.status === "paused"}
          onPause={canPause ? () => dispatch({ type: "pause" }) : undefined}
          onResume={() => dispatch({ type: "resume" })}
          onRestart={start}
          onExit={() => navigate("/")}
          screenRef={screenRef}
        >
          <div className="play-screen" data-status={session.status}>
            {screen}
          </div>
        </Stage>
      </div>
      <aside className="play-aside">
        <div className="play-intro">
          <h1 className="title">{game.title}</h1>
          <p className="small play-desc">{game.description}</p>
          <p className="meta play-meta">{`${game.genre} · ${game.players} · ${game.duration}`}</p>
          <div className="play-toggles">
            <Toggle
              icon={<Heart />}
              label="お気に入り"
              pressed={favorite}
              onChange={() => toggleFavorite(game.id)}
            />
            <Toggle
              icon={<Volume2 />}
              pressedIcon={<VolumeX />}
              label="消音"
              iconOnly
              pressed={settings.muted}
              onChange={(muted) => settingsStore.set((current) => ({ ...current, muted }))}
            />
          </div>
        </div>
        {game.modes.length > 1 ? (
          <div className="play-mode">
            <span className="kg-field-label">{game.modeLabel ?? "モード"}</span>
            <Segmented
              label={game.modeLabel ?? "モード"}
              options={game.modes.map((option) => ({ value: option.id, label: option.label }))}
              value={mode}
              onChange={changeMode}
            />
          </div>
        ) : null}
        <div className="play-stats">
          <Stat
            label="自己ベスト"
            value={modeRecord.best === null ? "—" : game.formatScore(modeRecord.best)}
          />
          <Stat label="遊んだ回数" value={String(modeRecord.plays)} unit="回" />
        </div>
        <RankingPanel game={game} mode={mode} version={rankingVersion} />
        <RecentPlays game={game} record={modeRecord} />
      </aside>
    </main>
  );
}
