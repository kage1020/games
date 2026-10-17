# game.kage1020.com 設計

登録なしで遊べる小さなゲームの遊び場。デザインシステム kage1020（<https://claude.ai/artifact/Fmj3KNMPbXH8ghAYjoz9ZA>）を額縁として使い、ゲームの中身には染み出させる。

## 構成

| 場所 | 役割 |
| --- | --- |
| `src/` | React の SPA。一覧・ゲーム・記録と設定の 3 画面 |
| `src/design-system/` | デザインシステムの取り込み。`vendor/` は配布物そのまま（`tokens.json`・`bundle.css`）、`tokens.css` は `tokens.json` から生成、`components/` は `bundle.js` を TSX に移した部品（クラス名は `kg-` のまま） |
| `src/sdk/` | ゲームとプラットフォームの約束（型・ループ・入力・乱数・音） |
| `src/games/<id>/` | 1 ゲーム = 1 フォルダ。`logic.ts`（純粋な規則）・`Game.tsx`（描画と入力）・`Thumb.tsx`（一覧のサムネイル）・`index.ts`（定義） |
| `src/platform/` | 記録（端末）・設定・引き継ぎコード・ランキング通信・音 |
| `shared/` | ブラウザと Worker の両方が使う規則（ゲーム目録・コード・名前・期間・API の型） |
| `worker/` | Cloudflare Worker。`/api/*` だけを受け持つ |
| `migrations/` | D1 のスキーマ |

配信は Cloudflare Workers の静的アセット（`not_found_handling: single-page-application`、`run_worker_first: ["/api/*"]`）。カスタムドメイン `game.kage1020.com`。

## デザインシステムの取り込み

- `tokens.css` は配布されないため、`format.md` の「tokens.css as compiled」の形で `tokens.json` から生成する（`pnpm tokens`）。
  - `:root, [data-theme="light"]` に色と影、`[data-theme="dark"]` に上書きとエイリアスの再宣言、`:root` に余白・角丸・大きさ・縦横比・重なり・`--font-<key>`、型スタイルごとに `.<name>` クラス。
- `bundle.css` は手を入れずに `vendor/kage.css` として読み込む。アプリ固有の配置（ペインの幅、Stage の収め方）だけをアプリ側 CSS に書く。新しい色・角丸・影・フォントは足さない。
- 部品は `bundle.js` の振る舞いと `index.d.ts` の props を正とし、TSX に移す。リンクを描く部品はルーターに依存せず、`LinkProvider` から渡されたリンク部品で描く。
- `bundle.js` から振る舞いを変えたところ（デザインシステムに戻すときの候補）：
  - `Stage`：一時停止中の Esc で再開する（「Esc で続ける」の表示どおりにする）。
  - `Segmented`：中身をネイティブの radio にした。選択中の見た目は `bundle.css` の `aria-checked` と同じ指定をアプリ側 CSS に置く。
  - `Result`：`p` に `aria-label` は付けられないため、数え上げの文字は読み上げから外し、最終の数を見えない文字で渡す。
  - `Gallery`：`div[role=list]` を `ul` / `li` にした。
  - `AppBar`：画面に別の `h1` があるときのために、タイトルを `div` にもできる（`titleAs`）。
- アイコンは lucide（`lucide-react`）。16px、ツールバーと AppBar は 20px、`currentColor`。
- ロゴマークは持たない。帯の名前は `game`（`ui-strong`）＋ `.kage1020.com`（`code`・`ink-muted`）。

## 画面

### 一覧 `/`（ShowcaseLayout）
- 帯：名前（一覧へのリンク）、右に「記録と設定」とテーマ切り替えのアイコンボタン。狭い画面では `AppBar`。
- hairline の下に `figure` で「8 つのゲーム」、一行の説明「小さな遊び。どれも登録なしで遊べる。」、右に種類の `Segmented`（すべて / パズル / アクション / 測定）。
- `Gallery` に `ContentCard`。meta は「種類 · 人数 · 目安の時間」、遊んだことがあれば時間の代わりに「ベスト <記録>」。お気に入りは先頭に並び、badge に「お気に入り」。

### ゲーム `/:gameId`（ContentLayout）
- 左：`Breadcrumb`（一覧 > ゲーム名）、`Stage`（中身はゲーム）。右：名前・説明・`Toggle`（お気に入り・消音）、モードの `Segmented`（モードが 2 つ以上のとき）、自己ベストと遊んだ回数の `Stat`、`Ranking`（期間の `Segmented`）、ランキングでの名前と「変える」リンク、最近の記録。
- 狭い画面では `AppBar`（戻る＝一覧へ）と縦積み。
- Stage の中は 4 つの状態：はじめる前（名前・遊び方・「はじめる」）→ 遊んでいる → 一時停止（時間の流れるゲームだけ）→ 結果。

### 記録と設定 `/settings`
- 表示：テーマ（端末に合わせる / ライト / ダーク）の `RadioGroup`。
- 音：音量の `Slider`（0 で鳴らさない）。
- ランキング：名前の `Input`（離れたとき・Enter で保存、`Notice` で元に戻す）。
- 引き継ぎ：この端末のコード（表示・コピー）と、別の端末のコードを入れる欄。
- この端末の記録：ゲームごとのベストと回数の `Table`、「記録を消す」（すぐ消して `Notice` で元に戻す）。

### 見つからない
- `EmptyState`「そのページは見つからない。」と一覧へのリンク。

## ゲームの約束（SDK）

```ts
interface GameProps {
  mode: string;            // 目録のモード id
  paused: boolean;         // true の間は時間を進めず、入力も受けない
  seed: number;            // 乱数の種。もう一度のたびに変わる
  sound: Sound;            // play("tap" | "good" | "bad" | "clear" | "over")
  reducedMotion: boolean;
  onHud(items: HudItem[]): void;       // Stage の帯に出す数（表示が変わるときだけ呼ぶ）
  onFinish(result: GameResult): void;  // { score: number | null, stats?: HudItem[], note?: string }
}
```

- 描画は SVG（`viewBox` で伸縮、色はトークンの CSS 変数）。地は `bg`、図形と文字は `ink`、空きは `border` の点、カーソルは `focus` の 2px の枠、色味は `accent`、系列は `series-1`〜`4`（番号・形・言葉を必ず添える）。
- 操作は Stage の `controls` に書く。キーボードとポインター（タッチ）の両方で遊べる。
- `score: null` は記録の残らない終わり（地雷を踏んだなど）。

## 記録・ランキング・引き継ぎ

- 記録はまず端末（localStorage）に残す。ランキングへの送信が失敗したら送信待ちに積み、起動時・通信の復帰時・次の終了時に送り直す。
- ランキングは D1。プレイヤーは引き継ぎコード（160bit、Crockford base32 で 32 字）で識別し、サーバーはその SHA-256 だけを持つ。登録の手続きはない。
- 期間は日本時間で区切る（今日 = 0 時から、今週 = 月曜 0 時から、すべて）。プレイヤーごとの最良の記録で順位を付け、同じ記録は同じ順位。

### API

| メソッド | パス | 認証 | 内容 |
| --- | --- | --- | --- |
| `POST` | `/api/scores` | 必須 | `{ game, mode, score, at?, name? }` を記録し、`{ best, ranks: { today, week, all } }`（各 `{ rank, total }`）を返す |
| `GET` | `/api/rankings?game&mode&period&limit` | 任意 | `{ rows: [{ rank, name, score, me }], me, total }` |
| `GET` | `/api/me` | 必須 | `{ name, bests: [{ game, mode, best, plays }] }`。未知のコードは 404 |
| `PUT` | `/api/me` | 必須 | `{ name }` を保存して `{ name }` を返す |

- 認証は `Authorization: Bearer <コード>`。コードは受け側で正規化する。
- エラーは `{ error: { code } }`。文言はブラウザ側でユーザーの言葉にする。

## ゲーム

| id | 名前 | 種類 | 人数 | 目安 | 縦横比 | 時間 | 記録 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `memory` | 数の記憶 | 測定 | 1人 | 2分 | wide | 流れない | 覚えた数（多いほどよい） |
| `zip` | 点つなぎ | パズル | 1人 | 3分 | square | 流れる | 5 面の合計時間（短いほどよい） |
| `territory` | 陣取り | アクション | 2〜4人 | 1分 | wide | 流れる | 自分のマス（多いほどよい） |
| `snake` | 蛇 | アクション | 1人 | 3分 | square | 流れる | 食べた数（多いほどよい） |
| `stack` | 積み木 | アクション | 1人 | 1分 | tall | 流れる | 積んだ段（多いほどよい） |
| `reaction` | 反応 | 測定 | 1人 | 1分 | wide | 流れる | 5 回の平均（短いほどよい） |
| `mines` | 地雷 | パズル | 1人 | 5分 | square | 流れる | 開けきった時間（短いほどよい） |
| `breakout` | 壁崩し | アクション | 1人 | 3分 | square | 流れる | 崩した数（多いほどよい） |

---

# 受け入れ条件（AC）

テストはこの AC から書く。AC は確定とし、変えるときは理由を残す。

## AC-T トークン（`scripts/lib/tokens-to-css.ts`）
- AC-T1 1 行目は `/* kage1020 — generated from tokens.json */`。
- AC-T2 最初のテーマの色は `:root, [data-theme="light"]` の中に `--<name>: <value>;` で出る。
- AC-T3 後のテーマは `[data-theme="dark"]` に、値が異なる色と、すべてのエイリアスを再宣言する。
- AC-T4 エイリアス `{accent}` は `var(--accent)` になる。
- AC-T5 色以外の家族（spacing・radius・size・shadow・aspect・zIndex）は `:root` に `--<name>` で出る。shadow は色と同じブロックに出る。
- AC-T6 `type.families` は `--font-<key>` で `:root` に出る。
- AC-T7 型スタイルごとに `.<name> { font-family; font-size; line-height; font-weight; letter-spacing? }` が出る。family はグループの family の変数。数値の `fontWeight` はそのまま、単位のない `lineHeight` はそのまま。
- AC-T8 リポジトリの `tokens.css` は `vendor/tokens.json` から生成した結果と一致する。

## AC-S 共有の規則（`shared/`）
### 目録 `catalog.ts`
- AC-S1 8 つのゲーム id がある。各ゲームは 1 つ以上のモード、記録の向き（`asc` / `desc`）、記録の下限と上限を持つ。
- AC-S2 `isValidScore(game, mode, score)` は、目録にないゲーム・モード、整数でない値、下限未満・上限超えを拒む。
- AC-S3 `isBetter(order, a, b)` は `desc` なら a > b、`asc` なら a < b。
### 引き継ぎコード `code.ts`
- AC-S4 `generateCode()` は Crockford base32（`0-9A-Z` から `I L O U` を除く）の 32 字。
- AC-S5 `normalizeCode(input)` は全角・小文字・空白・ハイフンを受け、`I`/`L` を `1`、`O` を `0` に読み替える。32 字にならなければ `null`。
- AC-S6 `formatCode(code)` は 4 字ずつハイフンでつなぐ。
### 名前 `name.ts`
- AC-S7 `normalizeName(input)` は NFKC にし、制御文字・書式文字を除き、連続する空白を 1 つにし、前後の空白を除く。
- AC-S8 16 字（コードポイント）を超えた分は切る。空になったら `null`。
### 期間 `period.ts`
- AC-S9 `periodStart("today", now)` は日本時間のその日の 0 時（UTC のミリ秒）。
- AC-S10 `periodStart("week", now)` は日本時間のその週の月曜 0 時。月曜 0 時ちょうどはその週。
- AC-S11 `periodStart("all", now)` は 0。

## AC-W Worker API（`worker/`）
- AC-W1 `POST /api/scores` は認証がなければ 401、不正なゲーム・モード・記録は 400。
- AC-W2 初めてのコードで記録すると、プレイヤーが作られる。名前の指定がなければ `guest-` ＋ 4 字。
- AC-W3 記録すると、自分の最良（`best`）と、今日・今週・すべての順位と人数を返す。
- AC-W4 順位はプレイヤーごとの最良で付け、同じ値は同じ順位（1, 2, 2, 4）。`asc` のゲームは小さいほど上。
- AC-W5 `GET /api/rankings` は上位 `limit`（既定 10、最大 50）件を返す。認証があり、自分が上位にいれば行に `me: true`、いなければ `me` に自分の行を返す。記録がなければ `me` は `null`。
- AC-W6 期間の外の記録は数えない。
- AC-W7 `at` は受け取るが、未来や 7 日より前はサーバーの時刻に置き換える。
- AC-W8 同じプレイヤーが同じゲームに 2 秒以内に続けて送ると 429（同時に送っても 1 件だけ入る）。レート制限を超えても 429。レート制限はプレイヤーと送り元のアドレスの両方で数える（コードは手元で作り直せるため）。
- AC-W9 `GET /api/me` は名前と、ゲーム・モードごとの最良と回数を返す。未知のコードは 404。
- AC-W10 `PUT /api/me` は名前を正規化して保存する。空なら 400。
- AC-W11 `/api/` の下の知らないパスは 404、知らないメソッドは 405。応答はすべて JSON。

## AC-R 端末の記録（`src/platform/records/`）
- AC-R1 初めての記録は `isFirst`、ベストになる。
- AC-R2 よりよい記録は `isBest`、前のベストを `previousBest` に返す。同じ値は `isTie`。
- AC-R3 回数を数え、最近の記録を新しい順に 10 件まで残す。
- AC-R4 `score: null` は回数だけ数え、ベストも最近の記録も変えない。
- AC-R5 ゲーム・モードごとに独立している。
- AC-R6 サーバーのベストを取り込むと、よいほうと回数の多いほうが残る。
- AC-R7 localStorage が使えない・中身が壊れているときは空の記録として動き、例外を投げない。

## AC-F 表示の整形（`src/platform/format.ts`）
- AC-F1 数は 3 桁区切り（`12,480`）。
- AC-F2 時間（ミリ秒）は `m:ss.s`（`1:02.3`）。1 時間を超えても分で数える。
- AC-F3 日時は、今日なら時刻（`02:07`）、昨日なら「昨日」、今年なら「10月8日」、それ以前は `2025/10/10`。
- AC-F4 名前の残り字数：16 字以内なら「あと N 字」、超えたら「N 字多い」。

## AC-P 遊ぶ流れ（`src/pages/play/session.ts`）
- AC-P1 はじめは `ready`。`start` で `playing`、run が 1 つ進む。
- AC-P2 `pause` は時間の流れるゲームの `playing` でだけ `paused` になる。`resume` で戻る。
- AC-P3 `finish` で `finished` になり、結果を持つ。`finished` からの `pause` は何もしない。
- AC-P4 `restart` はどの状態からも `playing` にし、run を進める。
- AC-P5 `describeResult` は、初めてなら「はじめての記録。」、更新なら「自己ベストを更新した。」（celebrate）、並べば「自己ベストに並んだ。」、それ以外は「自己ベストは <ベスト>。」。`score: null` ならゲームの note か「記録は残らない。」。

## AC-U 画面と部品
- AC-U1 `Button` に `disabled` を渡しても、押せるままである。`loading` は `aria-busy` を付け、クリックを止めない。
- AC-U2 `Stage` は `onPause` があれば Esc で一時停止し、一時停止中の Esc で再開する。一時停止中は `bg` で覆い「続ける」にフォーカスを置く。
- AC-U3 プレイ中にタブを離れると（`visibilitychange` で hidden）一時停止する。時間の流れないゲームは止めない。
- AC-U4 `Result` は動きを減らす設定では、最初から最終の数を出す。読み上げには数え上げの途中を出さず、最終の数だけを渡す（`p` に `aria-label` は付けられないため、見えない文字で渡す）。
- AC-U5 一覧は 8 つのカードを出し、種類の `Segmented` で絞り込める。絞り込みの数は `figure` に反映する。
- AC-U6 お気に入りにしたゲームは一覧の先頭に並ぶ。
- AC-U7 結果の画面では「もう一度」にフォーカスがあり、Enter で始め直せる。
- AC-U8 ランキングが読み込めないときは `Notice`（danger）で知らせ、読み込み直す操作を出す。記録が 0 件なら `EmptyState`「まだ記録がない。」。
- AC-U9 テーマの設定は `<html data-theme>` に反映し、「端末に合わせる」は `prefers-color-scheme` に従う。`public/theme-init.js` は描画前に同じ結果を出す。
- AC-U10 名前の入力は離れたときに保存し、`Notice` の「元に戻す」で前の名前に戻る。
- AC-U11 引き継ぎコードを入れると、サーバーで確かめてから入れ替え、サーバーのベストを取り込む。見つからなければ入力欄にエラー（原因と次の一手）を出す。

## AC-G ゲームの規則（各 `src/games/<id>/logic.ts`）

共通：乱数は種から決まる（同じ種なら同じ盤面）。時間を扱う関数は経過ミリ秒を引数で受ける。

### 数の記憶 `memory`
- AC-G-memory-1 盤は 8×5。レベル n では 1〜n の数が別々のマスに置かれる。はじめは 4。
- AC-G-memory-2 はじめは全部の数が見える。1 を押すと残りの数が隠れる。
- AC-G-memory-3 数のないマスを押しても何も起きない。
- AC-G-memory-4 次の数を押せば進み、n まで押せばレベルクリア（記録は n）。次はレベル n+1、上限 40。
- AC-G-memory-5 順番を間違えるとミスが 1 つ増え、同じレベルを別の配置でやり直す。ミス 3 つで終わる。
- AC-G-memory-6 40 をクリアしたら終わる。記録は覚えた数の最大（何もクリアしなければ 0）。

### 点つなぎ `zip`
- AC-G-zip-1 生成される盤は N×N で、1〜K の番号マスを持ち、1 から K まで番号順にすべてのマスを一度ずつ通る道が少なくとも 1 つある。
- AC-G-zip-2 道は常に 1 のマスから始まる。隣り合う（上下左右）まだ通っていないマスにだけ伸ばせる。
- AC-G-zip-3 番号マスには、次に来るべき番号のときだけ入れる。K のマスからは伸ばせない。
- AC-G-zip-4 道の 1 つ前のマスに戻ると最後の 1 マスを取り消す。道の途中のマスを選ぶと、そこまで縮む。
- AC-G-zip-5 すべてのマスを通って K で終わったら、その面はクリア。
- AC-G-zip-6 5 面（大きさ 4, 5, 5, 6, 6）を解いた合計の経過時間が記録。一時停止の間は数えない。

### 陣取り `territory`
- AC-G-territory-1 盤は 16×16。プレイヤーは 2〜4 人（あなた＋ CPU）で、四隅の 2×2 を持って始まる。
- AC-G-territory-2 1 歩ごとに全員が向きに沿って 1 マス進み、入ったマスを自分のものにする。盤の外へは進まない。
- AC-G-territory-3 自分のマスで囲んだ（盤の外から自分以外のマスを通ってたどれない）マスは自分のものになる。
- AC-G-territory-4 CPU は盤の外に向かわず、来た方向へすぐには戻らない。
- AC-G-territory-5 60 秒で終わる。記録は自分のマスの数。

### 蛇 `snake`
- AC-G-snake-1 盤は 20×20。長さ 3 で中央から右向きに始まる。餌は空いたマスに 1 つ。
- AC-G-snake-2 1 歩ごとに頭の向きへ進む。真後ろへの向き替えは無視する。向き替えは 2 つまで先に積める。
- AC-G-snake-3 餌を食べると 1 伸び、記録が 1 増え、餌が別の空きマスに出る。
- AC-G-snake-4 壁か自分の体に当たると終わる（動いて空いた尾のマスには入れる）。
- AC-G-snake-5 1 歩の間隔は長さとともに短くなり、下限がある。

### 積み木 `stack`
- AC-G-stack-1 板は左右の端で折り返しながら動く。段が上がるほど速い。
- AC-G-stack-2 落とすと、下の段と重なった部分だけが残る。重ならなければ終わる。
- AC-G-stack-3 ずれが小さい（幅の 3% 以下）ときは「ぴったり」として下の段と同じ位置・幅に揃える。
- AC-G-stack-4 記録は積んだ段の数（土台は数えない）。

### 反応 `reaction`
- AC-G-reaction-1 1 回ごとに 1.5〜4 秒の待ちのあと合図が出る。
- AC-G-reaction-2 合図の前に押すと「早すぎた」になり、その回を待ちからやり直す。
- AC-G-reaction-3 合図のあとに押すと、合図から押すまでのミリ秒がその回の記録。
- AC-G-reaction-4 5 回の平均（四捨五入）が記録。
- AC-G-reaction-5 一時停止から戻ると、その回は待ちからやり直す。

### 地雷 `mines`
- AC-G-mines-1 モードは「初級」9×9・10 個と「中級」16×16・40 個。
- AC-G-mines-2 最初に開くマスとその周り 8 マスには地雷を置かない。
- AC-G-mines-3 周りに地雷のないマスを開くと、つながる 0 のマスとその縁を一度に開く。
- AC-G-mines-4 旗は開いていないマスにだけ立て外しでき、旗のマスは開かない。
- AC-G-mines-5 開いた数字のマスを押し、周りの旗の数が数字と同じなら、旗のない周りを開く。
- AC-G-mines-6 地雷を開くと終わり（記録なし）。地雷以外を全部開くと終わり、最初に開いてからの経過時間が記録。

### 壁崩し `breakout`
- AC-G-breakout-1 壁は 8 列×5 段。球は壁・天井・板で跳ね返る。
- AC-G-breakout-2 板のどこに当たったかで返る角度が変わる（端ほど斜め）。
- AC-G-breakout-3 ブロックに当たるとそのブロックが消え、記録が 1 増え、球が跳ね返る。
- AC-G-breakout-4 球が下に落ちると残りが 1 減る。3 つ落とすと終わる。
- AC-G-breakout-5 壁をすべて崩すと、次の壁が出て球が少し速くなる。
- AC-G-breakout-6 球は 1 歩で大きく動いてもブロックをすり抜けない。
