import { bindings, defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "games",
    compatibilityDate: "2026-10-12",
    entrypoint: "./worker/index.ts",
    observability: { enabled: true },
    assets: {
      notFoundHandling: "single-page-application",
      runWorkerFirst: ["/api/*"],
    },
    domains: ["game.kage1020.com"],
    env: {
      // スキーマは migrations/ にあり、cf d1 migrations apply で入れる
      DB: bindings.d1({ name: "games", id: "ad24460e-af74-4904-9bea-7a4d904c4863" }),
      WRITE_LIMITER: bindings.rateLimit({
        namespace: "1020",
        simple: { limit: 30, period: 60 },
      }),
    },
  },
});
