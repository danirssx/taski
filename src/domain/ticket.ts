export const statuses = ["todo", "in_progress", "in_review", "done"] as const;
export type TicketStatus = typeof statuses[number];
export type TicketType = "task" | "feedback";

export class TaskiError extends Error {
  readonly code: string;
  constructor(code: string, message: string = code) { super(message); this.name = "TaskiError"; this.code = code; }
}

export interface Actor {
  memberId: string;
  name: string;
  kind: "person" | "agent";
  channel: "web" | "http" | "mcp";
  client: string;
  identityAssurance: "self_selected";
  // Trusted application context only. Never parsed from mutation bodies.
  completionFor?: readonly string[];
  authorizationRef?: string;
}

export interface Ticket {
  id: string;
  number: number;
  key: string;
  url: string;
  prefix: string;
  baseUrl: string;
  title: string;
  description: string;
  status: TicketStatus;
  assigneeId: string | null;
  areaId: string;
  type: TicketType;
  highlighted: boolean;
  prUrl: string | null;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export type TicketDraft = Omit<Ticket, "number" | "key" | "url">;
export type TicketChanges = Partial<Pick<Ticket, "title" | "description" | "status" | "assigneeId" | "areaId" | "type" | "highlighted" | "prUrl">>;
export interface Receipt { key: string; url: string; version: number; changed: string[]; commentId?: string }
export interface Comment { id: string; ticketId: string; ticketVersion: number; body: string; actor: Actor; createdAt: string }
export interface Activity { seq: number; ticketId: string; ticketKey: string; ticketVersion: number; actor: Actor; changes: Record<string, unknown>; createdAt: string }

export function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TaskiError("INVALID_INPUT", "Expected an object");
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new TaskiError("INVALID_INPUT", `Unknown field: ${key}`);
  return value as Record<string, unknown>;
}
export function text(value: unknown, field: string, max = 240, empty = false): string {
  if (typeof value !== "string" || value.length > max || (!empty && !value.trim())) {
    throw new TaskiError("INVALID_INPUT", `Invalid ${field}: expected ${empty ? "text" : "nonempty text"}, maximum ${max} characters`);
  }
  return value;
}
export function integer(value: unknown, field: string, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > max) throw new TaskiError("INVALID_INPUT", `Invalid ${field}`);
  return value;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  const result = JSON.stringify(value);
  if (result === undefined) throw new TaskiError("INVALID_INPUT", "Value is not JSON serializable");
  return result;
}
