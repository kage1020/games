import { handleApi } from "./api.ts";

export default {
  fetch(request, env) {
    return handleApi(request, { db: env.DB, limiter: env.WRITE_LIMITER, now: Date.now });
  },
} satisfies ExportedHandler<Env>;
