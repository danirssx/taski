import { statuses } from "../../domain/ticket.ts";
import type { OperationName } from "./operations.ts";

export const object = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object" as const, properties, required, additionalProperties: false,
});
const string = { type: "string", minLength: 1 };
const integer = { type: "integer", minimum: 1 };
const nullableString = { type: ["string", "null"] };
const array = (items: unknown) => ({ type: "array", items });
const looseObject = { type: "object" };
const boolean = { type: "boolean" };
const page = { type: "integer", minimum: 1, maximum: 50, default: 20 };
const status = { enum: [...statuses] };
const type = { enum: ["task", "feedback"] };
const patch = object({ find: { ...string, maxLength: 100000 }, replace: { type: "string", maxLength: 100000 } }, ["find", "replace"]);
const editable = {
  title: { ...string, maxLength: 240, pattern: "\\S" }, description: { type: "string", maxLength: 100000 },
  status, assigneeId: nullableString, areaId: string, type, highlighted: boolean, prUrl: nullableString,
};
const actor = object({ memberId: string, name: string, kind: { enum: ["person", "agent"] }, channel: { enum: ["web", "http", "mcp"] },
  client: string, identityAssurance: { const: "self_selected" }, authorizationRef: string },
  ["memberId", "name", "kind", "channel", "client", "identityAssurance"]);
const summaryFields = { key: string, title: string, status, assigneeId: nullableString, highlighted: boolean, version: integer };
const summary = object({ ...summaryFields, areaId: string, type, prUrl: nullableString }, Object.keys(summaryFields));
const ticket = object({ ...summary.properties, id: string, url: string, description: { type: "string" },
  createdBy: string, createdAt: string, updatedAt: string }, Object.keys(summaryFields));
const receipt = object({ key: string, url: string, version: integer, changed: array(string), commentId: string }, ["key", "url", "version", "changed"]);
const position = { cursor: string, limit: page };
const mutation = { key: string, expectedVersion: integer, idempotencyKey: { ...string, maxLength: 128 } };
const labels = { type: "object", additionalProperties: string };
const project = object({ id: string, name: string, prefix: string, baseUrl: string, locale: { const: "es" },
  brand: object({ name: string, accentLight: string, accentDark: string }, ["name", "accentLight", "accentDark"]),
  members: array(object({ id: string, name: string, defaultView: { enum: ["work", "feedback"] } }, ["id", "name", "defaultView"])),
  areas: array(object({ id: string, label: string }, ["id", "label"])), defaultAreaId: string,
  statusLabels: labels, typeLabels: labels, policy: object({ agentsCanComplete: boolean }, ["agentsCanComplete"]) },
  ["id", "name", "prefix", "baseUrl", "locale", "brand", "members", "areas", "defaultAreaId", "statusLabels", "typeLabels", "policy"]);

export const definitions = [
  { name: "get_project", description: "Read project configuration. Send knownVersion to omit unchanged members and labels.",
    inputSchema: object({ knownVersion: integer }),
    outputSchema: object({ configVersion: integer, notModified: boolean, project, activityCursor: string }, ["configVersion", "notModified", "activityCursor"]) },
  { name: "list_tickets", description: "List compact summaries. Cursor retains filters. Use work view for UI metadata; fetch detail separately.",
    inputSchema: object({ ...position, status, assigneeId: nullableString, areaId: string, type, view: { enum: ["summary", "work"], default: "summary" } }),
    outputSchema: object({ items: array(summary), nextCursor: nullableString, activityCursor: string, omitted: array(string) }, ["items", "nextCursor", "activityCursor", "omitted"]) },
  { name: "get_ticket", description: "Read a ticket and recent comments together. Full content is never silently truncated; page older comments.",
    inputSchema: object({ key: string, view: { enum: ["summary", "work", "full"], default: "work" },
      commentsLimit: { type: "integer", minimum: 0, maximum: 50 }, commentsCursor: string }, ["key"]),
    outputSchema: object({ ticket, comments: array(object({ id: string, ticketVersion: integer, body: string, actor, createdAt: string },
      ["id", "ticketVersion", "body", "actor", "createdAt"])), nextCommentsCursor: nullableString, omitted: array(string) }, ["ticket", "comments", "nextCommentsCursor", "omitted"]) },
  { name: "create_ticket", description: "Create and optionally assign in one call. Reuse the same idempotencyKey on retries.",
    inputSchema: object({ ...editable, idempotencyKey: mutation.idempotencyKey }, ["title", "idempotencyKey"]), outputSchema: receipt },
  { name: "update_ticket", description: "Atomically change fields/patch and add progress. Supply expectedVersion; stale writes fail.",
    inputSchema: { ...object({ ...mutation, changes: object(editable), descriptionPatch: patch, comment: { ...string, maxLength: 20000 } }, Object.keys(mutation)),
      anyOf: [{ required: ["changes"] }, { required: ["descriptionPatch"] }, { required: ["comment"] }] }, outputSchema: receipt },
  { name: "add_comment", description: "Add one comment with version and retry protection. Combine field changes using update_ticket.",
    inputSchema: object({ ...mutation, body: { ...string, maxLength: 20000 } }, [...Object.keys(mutation), "body"]), outputSchema: receipt },
  { name: "list_activity", description: "Read concrete changes since cursor, optionally for one ticket. Expired cursors require resynchronization.",
    inputSchema: object({ ...position, ticketKey: string }),
    outputSchema: object({ items: array(object({ seq: integer, ticketKey: string, ticketVersion: integer, actor, changes: looseObject, createdAt: string },
      ["seq", "ticketKey", "ticketVersion", "actor", "changes", "createdAt"])), nextCursor: string, hasMore: boolean }, ["items", "nextCursor", "hasMore"]) },
  { name: "link_pull_request", description: "Set a manual PR URL; does not query GitHub. Use update_ticket to combine PR and status.",
    inputSchema: object({ ...mutation, url: string }, [...Object.keys(mutation), "url"]), outputSchema: receipt },
] satisfies { name: OperationName; description: string; inputSchema: ReturnType<typeof object> & { anyOf?: unknown[] }; outputSchema: ReturnType<typeof object> }[];

export const serverInstructions = "One project per installation. Reuse configVersion and activity cursors. Lists are summaries; fetch needed detail. Mutations are version checked, audited and idempotent. Agents normally finish in review. Errors are explicit; never claim a failed write was saved.";
