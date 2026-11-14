export type Status = "todo" | "in_progress" | "in_review" | "done";
export interface Summary {
  key: string; title: string; status: Status; assigneeId: string | null; highlighted: boolean; version: number;
}
export interface WorkSummary extends Summary { areaId: string; type: "task" | "feedback"; prUrl: string | null }
export interface WorkTicket extends WorkSummary { url: string; description: string }
export interface FullTicket extends WorkTicket { id: string; createdBy: string; createdAt: string; updatedAt: string }
export interface Actor {
  memberId: string; name: string; kind: "person" | "agent"; channel: "web" | "http" | "mcp";
  client: string; identityAssurance: "self_selected"; authorizationRef?: string;
}
export interface Comment { id: string; ticketVersion: number; body: string; actor: Actor; createdAt: string }
export interface Receipt { key: string; url: string; version: number; changed: string[]; commentId?: string }
export type TicketView = "summary" | "work" | "full";
export type TicketResult<V extends TicketView = "work"> = {
  ticket: V extends "summary" ? Summary : V extends "full" ? FullTicket : WorkTicket;
  comments: Comment[]; nextCommentsCursor: string | null; omitted: string[];
};
export type ListView = "summary" | "work";
export interface ListOptions<V extends ListView = "summary"> {
  limit?: number; cursor?: string; status?: Status; assigneeId?: string | null; areaId?: string;
  type?: "task" | "feedback"; view?: V;
}
export type ListResult<V extends ListView = "summary"> = {
  items: (V extends "work" ? WorkSummary : Summary)[]; nextCursor: string | null; activityCursor: string; omitted: string[];
};
export interface Edits {
  title?: string; description?: string; status?: Status; assigneeId?: string | null;
  areaId?: string; type?: "task" | "feedback"; highlighted?: boolean; prUrl?: string | null;
}
export interface CreateTicket extends Edits { title: string; idempotencyKey: string }
export interface Mutation { expectedVersion: number; idempotencyKey: string }
export interface UpdateTicket extends Mutation { changes?: Edits; descriptionPatch?: { find: string; replace: string }; comment?: string }
export interface Activity {
  seq: number; ticketKey: string; ticketVersion: number; actor: Actor; changes: Record<string, unknown>; createdAt: string;
}
export interface ActivityResult { items: Activity[]; nextCursor: string; hasMore: boolean }
export interface ProjectResult {
  configVersion: number; notModified: boolean; activityCursor: string;
  project?: {
    id: string; name: string; prefix: string; baseUrl: string; locale: "es";
    brand: { name: string; accentLight: string; accentDark: string };
    members: { id: string; name: string; defaultView: "work" | "feedback" }[];
    areas: { id: string; label: string }[]; defaultAreaId: string;
    statusLabels: Record<Status, string>; typeLabels: Record<"task" | "feedback", string>;
    policy: { agentsCanComplete: boolean };
  };
}
