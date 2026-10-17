import type { GameId } from "@shared/catalog.ts";
import type { ComponentType } from "react";

export type SoundName = "tap" | "good" | "bad" | "clear" | "over";

export interface Sound {
  play(name: SoundName): void;
}

export interface HudItem {
  label: string;
  value: string;
  unit?: string;
}

export interface GameResult {
  /** null は記録の残らない終わり（地雷を踏んだなど） */
  score: number | null;
  stats?: HudItem[];
  note?: string;
}

export interface GameProps {
  mode: string;
  /** true の間は時間を進めず、入力も受けない */
  paused: boolean;
  /** 乱数のシード。「もう一度」のたびに変わる */
  seed: number;
  sound: Sound;
  reducedMotion: boolean;
  /** Stage の HUD に出す数値。表示が変わるときだけ呼ぶ */
  onHud(items: HudItem[]): void;
  onFinish(result: GameResult): void;
}

export type Genre = "パズル" | "アクション" | "脳トレ";
export type Aspect = "wide" | "square" | "tall";

export interface ControlHint {
  keys?: string[];
  text: string;
}

export interface GameMode {
  id: string;
  label: string;
}

export interface GameDefinition {
  id: GameId;
  title: string;
  /** 一覧のカードに出すひとこと */
  summary: string;
  /** ゲーム画面の説明。遊び方を 1〜2 文で */
  description: string;
  genre: Genre;
  players: string;
  duration: string;
  aspect: Aspect;
  /** 時間の流れるゲーム。Esc とタブの切り替えで一時停止する */
  timed: boolean;
  modes: GameMode[];
  modeLabel?: string;
  scoreLabel: string;
  formatScore(score: number): string;
  /** 自己ベストとの差を Stat の delta に渡す値と単位にする */
  formatDelta?(diff: number): { value: number; unit?: string };
  controls: ControlHint[];
  Thumb: ComponentType;
  /** 遊ぶときに読み込むよう、ふつうは React.lazy で包む */
  Game: ComponentType<GameProps>;
}
