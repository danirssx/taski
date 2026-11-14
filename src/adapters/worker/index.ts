import { healthResponse } from "../http/health.ts";
import { checkHealth } from "../../application/health.ts";
import { d1Readiness } from "../storage/d1-readiness.ts";
import "../../config/index.ts";
import { installation } from "../../config/index.ts";
import { TeamAccess } from "../access/team-access.ts";
import type { AccessEnvironment } from "../access/team-access.ts";
import { errorResponse } from "../http/body.ts";

interface Env extends AccessEnvironment {
  DB: D1Database;
}


export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/session") {
      try { return await new TeamAccess(env, installation).handle(request); }
      catch (error) { return errorResponse(error); }
    }
    if (path === "/api/v1/access" && request.method === "GET") {
      return Response.json({ projectName: installation.project.name, brandName: installation.brand.name,
        members: installation.members }, { headers: { "cache-control": "no-store" } });
    }
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
