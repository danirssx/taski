import { healthResponse } from "../http/health.ts";

export default {
  fetch(request: Request): Response {
    if (new URL(request.url).pathname !== "/health") {
      return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }
    if (request.method !== "GET") {
      return Response.json({ error: { code: "METHOD_NOT_ALLOWED" } }, {
        status: 405,
        headers: { allow: "GET" },
      });
    }
    return healthResponse({ service: "taski", status: "ok" });
  },
} satisfies ExportedHandler;
