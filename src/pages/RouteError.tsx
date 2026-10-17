import { Button, Notice } from "@/design-system/index.ts";

/** 画面を描けなかったとき（新しい版が出て古い部品がなくなった、通信が切れたなど）。帯は残す */
export function RouteError() {
  return (
    <main className="page narrow route-error">
      <title>読み込めなかった — game.kage1020.com</title>
      <h1 className="title">読み込めなかった</h1>
      <Notice tone="danger">
        画面を読み込めなかった。新しい版が出たか、通信が切れたのかもしれない。読み込み直してほしい。
      </Notice>
      <div className="route-error-actions">
        <Button variant="primary" onClick={() => window.location.reload()}>
          読み込み直す
        </Button>
        <Button href="/">一覧へ</Button>
      </div>
    </main>
  );
}
