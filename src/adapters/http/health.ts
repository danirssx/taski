import type { ServiceHealth } from "../../application/health.ts";

export function healthResponse(health: ServiceHealth): Response {
  return Response.json(health, {
    status: health.status === "ok" ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
