import { record, TaskiError } from "../../domain/ticket.ts";
import { Operations } from "../api/operations.ts";
import type { OperationName } from "../api/operations.ts";
import { TicketService } from "../../application/tickets.ts";
import { D1TicketRepository } from "../storage/d1-tickets.ts";
import { TeamAccess } from "../access/team-access.ts";
import type { AccessEnvironment } from "../access/team-access.ts";
import type { InstallationConfig } from "../../config/types.ts";
import { runtime } from "../worker/runtime.ts";
import { errorResponse, jsonBody } from "./body.ts";

export async function api(request: Request, env: AccessEnvironment, config: InstallationConfig): Promise<Response> {
  try {
    const actor = await new TeamAccess(env, config).authenticate(request, "http");
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const operations = new Operations(new TicketService(new D1TicketRepository(env.DB), config, runtime), config);
    const query: Record<string, unknown> = {};
    for (const [key, value] of url.searchParams) {
      if (key in query) throw new TaskiError("INVALID_INPUT", "Repeated query parameter");
      query[key] = ["limit", "commentsLimit", "knownVersion"].includes(key) ? Number(value) : key === "assigneeId" && value === "~" ? null : value;
    }
    let operation: OperationName | undefined, input: unknown = query, allow = "GET";
    if (parts.length === 3 && parts[2] === "project") operation = request.method === "GET" ? "get_project" : undefined;
    else if (parts.length === 3 && parts[2] === "activity") operation = request.method === "GET" ? "list_activity" : undefined;
    else if (parts[2] === "tickets" && parts.length === 3) {
      allow = "GET, POST";
      if (request.method === "GET") operation = "list_tickets";
      else if (request.method === "POST") { operation = "create_ticket"; input = await jsonBody(request); }
    } else if (parts[2] === "tickets" && parts.length === 4) {
      allow = "GET, PATCH";
      if (request.method === "GET") { operation = "get_ticket"; input = { ...query, key: parts[3] }; }
      else if (request.method === "PATCH") {
        operation = "update_ticket";
        input = { ...record(await jsonBody(request), ["expectedVersion", "idempotencyKey", "changes", "descriptionPatch", "comment"]), key: parts[3] };
      }
    } else if (parts[2] === "tickets" && parts.length === 5 && ["comments", "pull-request"].includes(parts[4]!)) {
      const comments = parts[4] === "comments"; allow = comments ? "POST" : "PUT";
      if (request.method === allow) {
        operation = comments ? "add_comment" : "link_pull_request";
        input = { ...record(await jsonBody(request), ["expectedVersion", "idempotencyKey", comments ? "body" : "url"]), key: parts[3] };
      }
    } else throw new TaskiError("NOT_FOUND");
    if (!operation) return new Response(null, { status: 405, headers: { allow } });
    const result = await operations.execute(operation, input, actor);
    return Response.json(result, { status: operation === "create_ticket" ? 201 : 200, headers: { "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
