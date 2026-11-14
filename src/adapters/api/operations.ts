import { TaskiError, canonical, integer, record, text } from "../../domain/ticket.ts";
import type { Actor, Ticket, TicketSummary } from "../../domain/ticket.ts";
import type { InstallationConfig } from "../../config/types.ts";
import type { ListQuery, TicketService } from "../../application/tickets.ts";

export const operationNames = ["get_project", "list_tickets", "get_ticket", "create_ticket", "update_ticket", "add_comment", "list_activity", "link_pull_request"] as const;
export type OperationName = typeof operationNames[number];

function encode(value: Record<string, unknown>): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decode(value: unknown, kind: string): Record<string, unknown> {
  try {
    const raw = text(value, "cursor", 4096);
    if (!/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error();
    const json = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(json, (c) => c.charCodeAt(0))));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || parsed.kind !== kind) throw new Error();
    return parsed as Record<string, unknown>;
  } catch { throw new TaskiError("INVALID_CURSOR", "Invalid cursor; start a fresh query"); }
}
function nonnegative(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new TaskiError("INVALID_CURSOR");
  return value;
}
function checkEpoch(cursor: Record<string, unknown>, epoch: string): void {
  if (cursor.epoch !== epoch) throw new TaskiError("CURSOR_EXPIRED", "Resynchronize project, ticket pages and activity from a fresh cursor");
}
function summary(t: TicketSummary) { return { key: t.key, title: t.title, status: t.status, assigneeId: t.assigneeId, highlighted: t.highlighted, version: t.version }; }
function full(t: Ticket) {
  return { id: t.id, key: t.key, url: t.url, title: t.title, description: t.description, status: t.status,
    assigneeId: t.assigneeId, areaId: t.areaId, type: t.type, highlighted: t.highlighted, prUrl: t.prUrl,
    version: t.version, createdBy: t.createdBy, createdAt: t.createdAt, updatedAt: t.updatedAt };
}

export class Operations {
  readonly service: TicketService;
  readonly config: InstallationConfig;
  constructor(service: TicketService, config: InstallationConfig) { this.service = service; this.config = config; }
  async execute(name: OperationName, input: unknown, actor: Actor): Promise<Record<string, unknown>> {
    switch (name) {
      case "get_project": return this.project(input);
      case "list_tickets": return this.list(input);
      case "get_ticket": return this.get(input);
      case "list_activity": return this.activity(input);
      case "create_ticket": return { ...await this.service.create(input, actor) };
      case "update_ticket": return { ...await this.service.update(input, actor) };
      case "add_comment": return { ...await this.service.addComment(input, actor) };
      case "link_pull_request": return { ...await this.service.linkPullRequest(input, actor) };
      default: throw new TaskiError("NOT_FOUND");
    }
  }
  private async position() {
    await this.service.repository.initialize(this.config.project);
    return this.service.repository.position();
  }
  async project(input: unknown) {
    const args = record(input, ["knownVersion"]);
    if (args.knownVersion !== undefined) integer(args.knownVersion, "knownVersion");
    const position = await this.position();
    const result: Record<string, unknown> = { configVersion: this.config.configVersion,
      notModified: args.knownVersion === this.config.configVersion,
      activityCursor: encode({ kind: "activity", epoch: position.epoch, after: position.sequence }) };
    if (!result.notModified) result.project = { ...this.config.project, locale: this.config.locale, brand: this.config.brand,
      members: this.config.members, areas: this.config.areas, defaultAreaId: this.config.defaultAreaId,
      statusLabels: this.config.statusLabels, typeLabels: this.config.typeLabels, policy: this.config.policy };
    return result;
  }
  async list(input: unknown) {
    const args = record(input, ["limit", "cursor", "status", "assigneeId", "areaId", "type", "view"]);
    const limit = args.limit === undefined ? 20 : integer(args.limit, "limit", 50);
    const position = await this.position();
    let afterNumber = 0;
    let filters = Object.fromEntries(Object.entries(args).filter(([key]) => !["limit", "cursor"].includes(key)));
    if (args.cursor !== undefined) {
      const cursor = decode(args.cursor, "tickets"); checkEpoch(cursor, position.epoch);
      if (cursor.revision !== position.sequence) throw new TaskiError("INVALID_CURSOR", "List changed; start a fresh query");
      afterNumber = nonnegative(cursor.afterNumber);
      const saved = record(cursor.filters, ["status", "assigneeId", "areaId", "type", "view"]);
      for (const [key, value] of Object.entries(filters)) if (!(key in saved) || canonical(value) !== canonical(saved[key])) throw new TaskiError("INVALID_CURSOR");
      filters = saved;
    }
    const view = filters.view ?? "summary";
    if (!["summary", "work"].includes(view as string)) throw new TaskiError("INVALID_INPUT", "Invalid list view");
    const query = { ...filters, limit: limit + 1, afterNumber }; delete (query as Record<string, unknown>).view;
    const all = await this.service.list(query as ListQuery);
    const end = await this.position();
    if (end.sequence !== position.sequence) throw new TaskiError("INVALID_CURSOR", "List changed; retry the query");
    const rows = all.slice(0, limit);
    return { items: rows.map((t) => view === "summary" ? summary(t) : { ...summary(t), areaId: t.areaId, type: t.type, prUrl: t.prUrl }),
      nextCursor: all.length > limit ? encode({ kind: "tickets", epoch: position.epoch, revision: position.sequence,
        afterNumber: rows.at(-1)!.number, filters }) : null,
      activityCursor: encode({ kind: "activity", epoch: position.epoch, after: position.sequence }),
      omitted: view === "summary" ? ["description", "comments", "history", "areaId", "type", "prUrl"] : ["description", "comments", "history"] };
  }
  async get(input: unknown) {
    const args = record(input, ["key", "view", "commentsLimit", "commentsCursor"]);
    const view = args.view ?? "work";
    if (!["summary", "work", "full"].includes(view as string)) throw new TaskiError("INVALID_INPUT", "Invalid ticket view");
    let limit = args.commentsLimit ?? (view === "summary" ? 0 : 5);
    if (limit !== 0) limit = integer(limit, "commentsLimit", 50);
    const t = await this.service.get(text(args.key, "key", 200));
    const position = await this.position(); let before = t.version + 1;
    if (args.commentsCursor !== undefined) {
      const cursor = decode(args.commentsCursor, "comments"); checkEpoch(cursor, position.epoch);
      if (cursor.ticketId !== t.id || cursor.version !== t.version) throw new TaskiError("INVALID_CURSOR", "Ticket changed; read recent comments again");
      before = nonnegative(cursor.before);
      if (before > t.version + 1) throw new TaskiError("INVALID_CURSOR");
    }
    const all = limit === 0 ? [] : await this.service.repository.comments(t.id, before, (limit as number) + 1);
    const comments = all.slice(0, limit as number);
    const ticket = view === "summary" ? summary(t) : view === "work"
      ? { ...summary(t), url: t.url, description: t.description, areaId: t.areaId, type: t.type, prUrl: t.prUrl } : full(t);
    return { ticket, comments: comments.slice().reverse().map(({ ticketId: _id, ...c }) => c),
      nextCommentsCursor: all.length > (limit as number) ? encode({ kind: "comments", epoch: position.epoch, ticketId: t.id,
        version: t.version, before: comments.at(-1)!.ticketVersion }) : null,
      omitted: ["history", ...(view === "summary" ? ["description", "areaId", "type", "prUrl", "createdAt", "updatedAt"] : []),
        ...(limit === 0 ? ["comments"] : all.length > (limit as number) ? ["olderComments"] : [])] };
  }
  async activity(input: unknown) {
    const args = record(input, ["cursor", "limit", "ticketKey"]);
    const limit = args.limit === undefined ? 20 : integer(args.limit, "limit", 50);
    const position = await this.position(); let after = 0; let ticketKey = args.ticketKey;
    if (args.cursor !== undefined) {
      const cursor = decode(args.cursor, "activity"); checkEpoch(cursor, position.epoch);
      after = nonnegative(cursor.after);
      if (after > position.sequence) throw new TaskiError("INVALID_CURSOR");
      if (ticketKey !== undefined && cursor.ticketKey !== undefined && cursor.ticketKey !== ticketKey) throw new TaskiError("INVALID_CURSOR");
      ticketKey ??= cursor.ticketKey;
    }
    const ticketId = ticketKey === undefined ? undefined : (await this.service.get(text(ticketKey, "ticketKey", 200))).id;
    const all = await this.service.repository.activity(after, limit + 1, ticketId);
    const items = all.slice(0, limit);
    return { items: items.map(({ ticketId: _id, ...event }) => event), hasMore: all.length > limit,
      nextCursor: encode({ kind: "activity", epoch: position.epoch, after: items.at(-1)?.seq ?? position.sequence,
        ...(ticketKey === undefined ? {} : { ticketKey }) }) };
  }
}
