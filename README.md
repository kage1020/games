# game.kage1020.com

登録なしで遊べる小さなゲームの遊び場。見た目と振る舞いはデザインシステム kage1020（<https://claude.ai/artifact/Fmj3KNMPbXH8ghAYjoz9ZA>）に従う。設計と受け入れ条件は [docs/design.md](docs/design.md)。

## 構成

- `src/` — React の SPA（一覧・ゲーム・記録と設定）
- `src/games/<id>/` — 1 ゲーム 1 フォルダ。`logic.ts` が規則、`Game.tsx` が描画と入力
- `worker/` — `/api/*` を受け持つ Cloudflare Worker（ランキング）
- `migrations/` — D1 のスキーマ
- `shared/` — ブラウザと Worker で共有する規則

## 開発

```sh
pnpm install
pnpm db:migrate:local   # ローカルの D1 にスキーマを入れる（初回だけ）
pnpm dev                # Vite + Worker（ローカルの D1 つき）
```

| コマンド | 内容 |
| --- | --- |
| `pnpm test` | Vitest（ブラウザ側は jsdom、Worker は node:sqlite で D1 と同じ SQL を流す） |
| `pnpm check` | Biome |
| `pnpm typecheck` | TypeScript（アプリ・Worker・設定ファイルの 3 プロジェクト） |
| `pnpm tokens` | `src/design-system/vendor/tokens.json` から `tokens.css` を作り直す |
| `pnpm og` | 一覧のサムネイルから共有用の画像 `public/og.png` を作り直す（ゲームを足したとき） |
| `pnpm cf:types` | `wrangler.jsonc` から `worker-configuration.d.ts` を作り直す |

## デザインシステムを更新するとき

1. デザインシステムの `project/tokens.json` と `project/components/bundle.css` を、`src/design-system/vendor/tokens.json` と `src/design-system/vendor/kage.css` にそのまま置き換える。
2. `pnpm tokens` で `tokens.css` を作り直す（テストが `tokens.json` との一致を確かめる）。
3. 部品の振る舞いが変わったら `src/design-system/components/` を合わせる。

## ゲームを足すとき

1. `docs/design.md` の表と AC に足す。
2. `shared/catalog.ts` にモード・記録の向き・上下限を足す（Worker が受け付ける範囲になる）。
3. `src/games/<id>/` に `logic.test.ts` → `logic.ts` → `Game.tsx`・`Thumb.tsx`・`index.ts` の順に作り、`src/games/registry.ts` に並べる。

## 公開

`wrangler.jsonc` は `game.kage1020.com` をカスタムドメインとして持ち、D1 データベース `games` を使う。

```sh
pnpm db:migrate:remote   # 本番の D1 にスキーマを入れる
pnpm run deploy          # ビルドして公開
```
