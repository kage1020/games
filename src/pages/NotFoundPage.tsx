import { Button, EmptyState } from "@/design-system/index.ts";

export function NotFoundPage() {
  return (
    <main className="page narrow">
      <title>見つからない — game.kage1020.com</title>
      <h1 className="title">見つからない</h1>
      <EmptyState
        title="そのページは見つからない。"
        description="アドレスが変わったか、なくなったゲームかもしれない。"
        action={<Button href="/">一覧へ</Button>}
      />
    </main>
  );
}
