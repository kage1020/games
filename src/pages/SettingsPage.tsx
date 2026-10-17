import { CODE_LENGTH, formatCode, normalizeCode } from "@shared/code.ts";
import { normalizeName } from "@shared/name.ts";
import { Copy, Eye, EyeOff } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useGames } from "@/app/games-context.tsx";
import { pageTitle } from "@/app/site.ts";
import {
  Button,
  EmptyState,
  Input,
  RadioGroup,
  SectionHead,
  Slider,
  Table,
} from "@/design-system/index.ts";
import { nameLengthHint } from "@/platform/format.ts";
import { ensureCode, identityStore } from "@/platform/identity.ts";
import { showNotice } from "@/platform/notices.tsx";
import { ApiRequestError } from "@/platform/ranking/client.ts";
import { useApi } from "@/platform/ranking/context.tsx";
import { getModeRecord } from "@/platform/records/records.ts";
import { importServerBests, recordsStore } from "@/platform/records/store.ts";
import { settingsStore, type ThemePreference } from "@/platform/settings.ts";
import { useStore } from "@/platform/store.ts";

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "端末に合わせる" },
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
];

function NameField() {
  const api = useApi();
  const { name } = useStore(settingsStore);
  // 入力している間だけ下書きを持つ。それ以外はいまの名前を出す（別の操作で変わっても古い名前で上書きしない）
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? name ?? "";

  const sync = (value: string | null) => {
    void api.putName(ensureCode(), value).catch(() => undefined);
  };

  const commit = (text: string) => {
    const next = normalizeName(text);
    if (next === name) return;
    const previous = name;
    settingsStore.set((current) => ({ ...current, name: next }));
    sync(next);
    showNotice({
      message: next ? `名前を「${next}」にした。` : "名前を消した。ランキングでは guest で出る。",
      onUndo: () => {
        settingsStore.set((current) => ({ ...current, name: previous }));
        sync(previous);
      },
    });
  };

  return (
    <Input
      id="name"
      label="名前"
      value={shown}
      placeholder="guest"
      hint={`ランキングに出る名前。${nameLengthHint(shown)}。`}
      onFocus={() => setDraft(name ?? "")}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== null) commit(draft);
        setDraft(null);
      }}
      onKeyDown={(event) => {
        // 日本語入力で変換を確定する Enter は保存しない
        if (event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (draft === null) return;
        commit(draft);
        setDraft(normalizeName(draft) ?? "");
      }}
      autoComplete="nickname"
    />
  );
}

function TransferPanel() {
  const api = useApi();
  const code = useStore(identityStore);
  const [shown, setShown] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = code ?? null;
  const masked = current
    ? shown
      ? formatCode(current)
      : formatCode("•".repeat(CODE_LENGTH))
    : "まだない（初めて遊び終えたときに作る）";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatCode(ensureCode()));
      showNotice({ message: "コードをコピーした。ほかの人には見せないでほしい。" });
    } catch {
      setShown(true);
      showNotice({
        tone: "danger",
        message: "コピーできなかった。表示したコードを書き写してほしい。",
      });
    }
  };

  const takeOver = async (event: FormEvent) => {
    event.preventDefault();
    const next = normalizeCode(input);
    if (!next) {
      setError(
        `コードは ${CODE_LENGTH} 字。前の端末の「記録と設定」に出ているコードを、そのまま入れてほしい。`,
      );
      return;
    }
    if (next === current) {
      setError("この端末のコードと同じ。別の端末に出ているコードを入れてほしい。");
      return;
    }
    setBusy(true);
    try {
      const me = await api.getMe(next);
      const previous = {
        code: current,
        records: recordsStore.get(),
        name: settingsStore.get().name,
      };
      identityStore.set(next);
      importServerBests(me.bests);
      settingsStore.set((settings) => ({ ...settings, name: me.name }));
      setInput("");
      setError(null);
      showNotice({
        message: "記録を引き継いだ。",
        onUndo: () => {
          identityStore.set(previous.code);
          recordsStore.set(previous.records);
          settingsStore.set((settings) => ({ ...settings, name: previous.name }));
        },
      });
    } catch (failure) {
      const reason = failure instanceof ApiRequestError ? failure.code : "internal";
      setError(
        reason === "not_found"
          ? "このコードの記録が見つからない。前の端末で一度ゲームを遊び終えてから、もう一度試してほしい。"
          : reason === "network"
            ? "通信できなかった。つながってから、もう一度試してほしい。"
            : "いまは確かめられなかった。少し待って、もう一度試してほしい。",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-stack">
      <p className="small settings-text">
        別の端末でこのコードを入れると、ランキングの記録を引き継げる。コードは鍵と同じなので、ほかの人には見せない。
      </p>
      <div className="transfer-code">
        <span className="kg-field-label">この端末のコード</span>
        <code className="code transfer-value">{masked}</code>
        {current ? (
          <div className="transfer-actions">
            <Button
              size="sm"
              variant="ghost"
              icon={shown ? <EyeOff /> : <Eye />}
              onClick={() => setShown(!shown)}
            >
              {shown ? "隠す" : "表示する"}
            </Button>
            <Button size="sm" variant="ghost" icon={<Copy />} onClick={() => void copy()}>
              コピー
            </Button>
          </div>
        ) : null}
      </div>
      <form className="transfer-form" onSubmit={(event) => void takeOver(event)}>
        <Input
          label="別の端末のコード"
          mono
          value={input}
          error={error}
          placeholder="XXXX-XXXX-…"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setInput(event.target.value);
            setError(null);
          }}
        />
        <Button type="submit" loading={busy}>
          引き継ぐ
        </Button>
      </form>
    </div>
  );
}

function LocalRecords() {
  const games = useGames();
  const records = useStore(recordsStore);
  const rows = games.flatMap((game) =>
    game.modes.flatMap((mode) => {
      const record = getModeRecord(records, game.id, mode.id);
      if (record.plays === 0) return [];
      return [
        {
          id: `${game.id}-${mode.id}`,
          game: game.modes.length > 1 ? `${game.title}（${mode.label}）` : game.title,
          best: record.best === null ? "—" : game.formatScore(record.best),
          plays: `${record.plays} 回`,
        },
      ];
    }),
  );

  const clear = () => {
    const previous = recordsStore.get();
    recordsStore.set({});
    showNotice({
      message: "この端末の記録を消した。ランキングの記録は残っている。",
      onUndo: () => recordsStore.set(previous),
    });
  };

  return (
    <div className="settings-stack">
      {rows.length === 0 ? (
        <EmptyState
          title="まだ記録がない。"
          description="遊び終えると、ここにベストと回数が残る。"
        />
      ) : (
        <>
          <Table
            columns={[
              { key: "game", label: "ゲーム" },
              { key: "best", label: "ベスト", align: "right", mono: true },
              { key: "plays", label: "回数", align: "right", mono: true },
            ]}
            rows={rows}
          />
          <div>
            <Button onClick={clear}>記録を消す</Button>
          </div>
        </>
      )}
    </div>
  );
}

export function SettingsPage() {
  const settings = useStore(settingsStore);
  return (
    <main className="page narrow settings">
      <title>{pageTitle("記録と設定")}</title>
      <h1 className="title">記録と設定</h1>
      <section className="settings-section" aria-labelledby="settings-display">
        <SectionHead id="settings-display">表示</SectionHead>
        <RadioGroup
          legend="テーマ"
          options={THEMES}
          value={settings.theme}
          onChange={(theme) =>
            settingsStore.set((current) => ({ ...current, theme: theme as ThemePreference }))
          }
        />
      </section>
      <section className="settings-section" aria-labelledby="settings-sound">
        <SectionHead id="settings-sound">音</SectionHead>
        <Slider
          label="音量"
          min={0}
          max={100}
          step={10}
          value={settings.volume}
          format={(volume) => (volume === 0 ? "鳴らさない" : `${volume}%`)}
          onChange={(volume) => settingsStore.set((current) => ({ ...current, volume }))}
        />
      </section>
      <section className="settings-section" aria-labelledby="settings-ranking">
        <SectionHead id="settings-ranking">ランキング</SectionHead>
        <NameField />
      </section>
      <section className="settings-section" aria-labelledby="settings-transfer">
        <SectionHead id="settings-transfer">引き継ぎ</SectionHead>
        <TransferPanel />
      </section>
      <section className="settings-section" aria-labelledby="settings-records">
        <SectionHead id="settings-records">この端末の記録</SectionHead>
        <LocalRecords />
      </section>
    </main>
  );
}
