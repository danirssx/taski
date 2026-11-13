import { healthResponse } from "../http/health.ts";
import { checkHealth } from "../../application/health.ts";
import { d1Readiness } from "../storage/d1-readiness.ts";
import "../../config/index.ts";

interface Env {
  DB: D1Database;
}


export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== "/health") {
      return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }
    if (request.method !== "GET") {
      return Response.json({ error: { code: "METHOD_NOT_ALLOWED" } }, {
        status: 405,
        headers: { allow: "GET" },
      });
    }
    return healthResponse(await checkHealth(d1Readiness(env.DB)));
  },
} satisfies ExportedHandler<Env>;
