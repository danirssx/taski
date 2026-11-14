import { TaskiError, canonical, integer, record, statuses, text } from "../domain/ticket.ts";
import type { Activity, Actor, Comment, Receipt, Ticket, TicketChanges, TicketDraft } from "../domain/ticket.ts";

export interface ProjectContext {
  readonly project: { readonly id: string; readonly prefix: string; readonly baseUrl: string };
  readonly members: readonly { readonly id: string; readonly name: string }[];
  readonly areas: readonly { readonly id: string }[];
  readonly defaultAreaId: string;
  readonly policy: { readonly agentsCanComplete: boolean };
}
export interface Runtime { id(): string; now(): string; hash(value: string): Promise<string> }
export interface ListQuery { limit: number; afterNumber: number; status?: string; assigneeId?: string | null; areaId?: string; type?: string }
export interface Mutation {
  create: boolean; operation: string; idempotencyKey: string; fingerprint: string;
  actor: Actor; ticket: TicketDraft; expectedVersion: number | null;
  changes: Record<string, unknown>; comment: { id: string; body: string } | null; at: string;
}
export interface TicketRepository {
  initialize(project: ProjectContext["project"]): Promise<void>;
  get(reference: string): Promise<Ticket | null>;
  list(query: ListQuery): Promise<Ticket[]>;
  replay(actorId: string, operation: string, key: string, fingerprint: string): Promise<Receipt | null>;
  commit(mutation: Mutation): Promise<Receipt>;
  comments(ticketId: string, beforeVersion: number, limit: number): Promise<Comment[]>;
  activity(after: number, limit: number): Promise<Activity[]>;
  position(): Promise<{ epoch: string; sequence: number }>;
}

const editable = ["title", "description", "status", "assigneeId", "areaId", "type", "highlighted", "prUrl"] as const;

export class TicketService {
  readonly repository: TicketRepository;
  readonly context: ProjectContext;
  readonly runtime: Runtime;
  constructor(repository: TicketRepository, context: ProjectContext, runtime: Runtime) {
    this.repository = repository; this.context = context; this.runtime = runtime;
  }

  private actor(actor: Actor): Actor {
    const member = this.context.members.find((entry) => entry.id === actor.memberId);
    if (!member) throw new TaskiError("UNKNOWN_MEMBER");
    if (!["person", "agent"].includes(actor.kind) || !["web", "http", "mcp"].includes(actor.channel)) throw new TaskiError("INVALID_ACTOR");
    text(actor.client, "client", 80);
    const result: Actor = { memberId: member.id, name: member.name, kind: actor.kind,
      channel: actor.channel, client: actor.client, identityAssurance: "self_selected" };
    if (actor.completionFor) result.completionFor = actor.completionFor;
    if (actor.authorizationRef) result.authorizationRef = text(actor.authorizationRef, "authorizationRef", 128);
    return result;
  }

  private changes(input: unknown): TicketChanges {
    const source = record(input, editable);
    const changes: TicketChanges = {};
    if ("title" in source) changes.title = text(source.title, "title").trim();
    if ("description" in source) changes.description = text(source.description, "description", 100000, true);
    if ("status" in source) {
      if (!(statuses as readonly unknown[]).includes(source.status)) throw new TaskiError("INVALID_INPUT", "Invalid status");
      changes.status = source.status as Ticket["status"];
    }
    if ("assigneeId" in source) {
      if (source.assigneeId !== null && !this.context.members.some((m) => m.id === source.assigneeId)) throw new TaskiError("UNKNOWN_MEMBER");
      changes.assigneeId = source.assigneeId as string | null;
    }
    if ("areaId" in source) {
      if (!this.context.areas.some((a) => a.id === source.areaId)) throw new TaskiError("UNKNOWN_AREA");
      changes.areaId = source.areaId as string;
    }
    if ("type" in source) {
      if (source.type !== "task" && source.type !== "feedback") throw new TaskiError("INVALID_INPUT", "Invalid type");
      changes.type = source.type;
    }
    if ("highlighted" in source) {
      if (typeof source.highlighted !== "boolean") throw new TaskiError("INVALID_INPUT", "Invalid highlighted");
      changes.highlighted = source.highlighted;
    }
    if ("prUrl" in source) {
      if (source.prUrl !== null && (typeof source.prUrl !== "string" || source.prUrl.length > 1000
          || !/^https:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?(?:\/[^\s?#]*)?$/i.test(source.prUrl))) throw new TaskiError("INVALID_INPUT", "Invalid HTTPS PR URL");
      changes.prUrl = source.prUrl as string | null;
    }
    return changes;
  }

  private completion(status: string, actor: Actor, key?: string): void {
    if (status === "done" && actor.kind === "agent" && !this.context.policy.agentsCanComplete
        && !(key && actor.completionFor?.includes(key))) throw new TaskiError("REVIEW_REQUIRED");
  }

  private async request(operation: string, args: Record<string, unknown>, actorInput: Actor) {
    const actor = this.actor(actorInput);
    const idempotencyKey = text(args.idempotencyKey, "idempotencyKey", 128);
    const fingerprint = await this.runtime.hash(canonical({ operation, args, actor }));
    await this.repository.initialize(this.context.project);
    const cached = await this.repository.replay(actor.memberId, operation, idempotencyKey, fingerprint);
    return { actor, idempotencyKey, fingerprint, cached };
  }

  async get(reference: string): Promise<Ticket> {
    text(reference, "ticket reference", 200);
    await this.repository.initialize(this.context.project);
    const ticket = await this.repository.get(reference);
    if (!ticket) throw new TaskiError("NOT_FOUND");
    return ticket;
  }

  async list(query: ListQuery): Promise<Ticket[]> {
    integer(query.limit, "limit", 50);
    if (!Number.isSafeInteger(query.afterNumber) || query.afterNumber < 0) throw new TaskiError("INVALID_INPUT", "Invalid position");
    const filters = Object.fromEntries(Object.entries(query).filter(([key]) => !["limit", "afterNumber"].includes(key)));
    this.changes(filters);
    await this.repository.initialize(this.context.project);
    return this.repository.list(query);
  }

  async create(input: unknown, actorInput: Actor): Promise<Receipt> {
    const source = record(input, [...editable, "idempotencyKey"]);
    const changes = this.changes(Object.fromEntries(Object.entries(source).filter(([key]) => key !== "idempotencyKey")));
    if (!changes.title) throw new TaskiError("INVALID_INPUT", "Title is required");
    const args = { ...changes, idempotencyKey: source.idempotencyKey };
    const request = await this.request("create_ticket", args, actorInput);
    if (request.cached) return request.cached;
    const at = this.runtime.now();
    const ticket: TicketDraft = { id: this.runtime.id(), prefix: this.context.project.prefix, baseUrl: this.context.project.baseUrl,
      title: changes.title, description: "", status: "todo", assigneeId: null, areaId: this.context.defaultAreaId,
      type: "task", highlighted: false, prUrl: null, ...changes, version: 1, createdBy: request.actor.memberId, createdAt: at, updatedAt: at };
    this.completion(ticket.status, request.actor);
    const delta = Object.fromEntries(editable.map((key) => [key, { before: null, after: ticket[key] }]));
    return this.repository.commit({ ...request, create: true, operation: "create_ticket", ticket,
      expectedVersion: null, changes: delta, comment: null, at });
  }

  async update(input: unknown, actorInput: Actor, operation = "update_ticket"): Promise<Receipt> {
    const source = record(input, ["key", "expectedVersion", "idempotencyKey", "changes", "descriptionPatch", "comment"]);
    const key = text(source.key, "key", 200);
    const expectedVersion = integer(source.expectedVersion, "expectedVersion");
    const changes = this.changes(source.changes ?? {});
    let patch: { find: string; replace: string } | undefined;
    if (source.descriptionPatch !== undefined) {
      const p = record(source.descriptionPatch, ["find", "replace"]);
      patch = { find: text(p.find, "patch.find", 100000), replace: text(p.replace, "patch.replace", 100000, true) };
      if ("description" in changes) throw new TaskiError("PATCH_CONFLICT");
    }
    const comment = source.comment === undefined ? null : text(source.comment, "comment", 20000);
    const args: Record<string, unknown> = { key, expectedVersion, idempotencyKey: source.idempotencyKey, changes };
    if (patch) args.descriptionPatch = patch;
    if (comment) args.comment = comment;
    const request = await this.request(operation, args, actorInput);
    if (request.cached) return request.cached;
    const before = await this.get(key);
    if (before.version !== expectedVersion) throw new TaskiError("VERSION_CONFLICT");
    if (patch) {
      if (before.description.split(patch.find).length !== 2) throw new TaskiError("PATCH_CONFLICT");
      changes.description = before.description.replace(patch.find, patch.replace);
      text(changes.description, "description", 100000, true);
    }
    if (changes.status !== undefined) this.completion(changes.status, request.actor, before.key);
    const delta: Record<string, unknown> = {};
    for (const key of editable) if (key in changes && before[key] !== changes[key]) delta[key] = { before: before[key], after: changes[key] };
    if (patch && "description" in delta) delta.description = { patch };
    const commentEntry = comment ? { id: this.runtime.id(), body: comment } : null;
    if (commentEntry) delta.commentAdded = commentEntry;
    if (!Object.keys(delta).length) throw new TaskiError("EMPTY_UPDATE");
    const at = this.runtime.now();
    return this.repository.commit({ ...request, create: false, operation, expectedVersion,
      ticket: { ...before, ...changes, version: before.version + 1, updatedAt: at }, changes: delta, comment: commentEntry, at });
  }

  async addComment(input: unknown, actor: Actor): Promise<Receipt> {
    const args = record(input, ["key", "expectedVersion", "idempotencyKey", "body"]);
    return this.update({ key: args.key, expectedVersion: args.expectedVersion, idempotencyKey: args.idempotencyKey, comment: args.body }, actor, "add_comment");
  }
  async linkPullRequest(input: unknown, actor: Actor): Promise<Receipt> {
    const args = record(input, ["key", "expectedVersion", "idempotencyKey", "url"]);
    return this.update({ key: args.key, expectedVersion: args.expectedVersion, idempotencyKey: args.idempotencyKey, changes: { prUrl: args.url } }, actor, "link_pull_request");
  }
}
