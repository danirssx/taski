import { TaskiError } from "../../domain/ticket.ts";
import type { Activity, Actor, Comment, Receipt, Ticket } from "../../domain/ticket.ts";
import type { ListQuery, Mutation, ProjectContext, TicketRepository } from "../../application/tickets.ts";

type Row = Record<string, unknown>;
function ticket(row: Row): Ticket {
  return { id: row.id as string, number: row.number as number, key: row.key as string, url: row.url as string,
    prefix: row.prefix as string, baseUrl: row.base_url as string, title: row.title as string,
    description: row.description as string, status: row.status as Ticket["status"], assigneeId: row.assignee_id as string | null,
    areaId: row.area_id as string, type: row.type as Ticket["type"], highlighted: Number(row.highlighted) === 1,
    prUrl: row.pr_url as string | null, version: row.version as number, createdBy: row.created_by as string,
    createdAt: row.created_at as string, updatedAt: row.updated_at as string };
}
function auditActor(actor: Actor): string {
  const { completionFor: _grants, ...snapshot } = actor;
  return JSON.stringify(snapshot);
}

export class D1TicketRepository implements TicketRepository {
  readonly db: D1Database;
  private initialized: Promise<void> | null = null;
  private identity = "";
  constructor(db: D1Database) { this.db = db; }

  initialize(project: ProjectContext["project"]): Promise<void> {
    const identity = `${project.id}:${project.prefix}`;
    if (this.identity && this.identity !== identity) return Promise.reject(new TaskiError("PROJECT_IDENTITY_CONFLICT"));
    this.identity = identity;
    return this.initialized ??= (async () => {
      await this.db.prepare("INSERT OR IGNORE INTO project_identity(singleton,project_id,prefix) VALUES(1,?,?)")
        .bind(project.id, project.prefix).run();
      const row = await this.db.prepare("SELECT project_id,prefix FROM project_identity WHERE singleton=1").first<Row>();
      if (row?.project_id !== project.id || row.prefix !== project.prefix) throw new TaskiError("PROJECT_IDENTITY_CONFLICT");
    })();
  }

  async get(reference: string): Promise<Ticket | null> {
    const row = await this.db.prepare("SELECT * FROM tickets WHERE key=? OR id=?").bind(reference, reference).first<Row>();
    return row ? ticket(row) : null;
  }

  async list(query: ListQuery): Promise<Ticket[]> {
    const where = ["number > ?"];
    const values: (string | number | null)[] = [query.afterNumber];
    for (const [key, column] of [["status", "status"], ["assigneeId", "assignee_id"], ["areaId", "area_id"], ["type", "type"]] as const) {
      if (query[key] !== undefined) { where.push(`${column} IS ?`); values.push(query[key]!); }
    }
    const { results } = await this.db.prepare(`SELECT * FROM tickets WHERE ${where.join(" AND ")} ORDER BY number LIMIT ?`)
      .bind(...values, query.limit).all<Row>();
    return results.map(ticket);
  }

  async replay(actorId: string, operation: string, key: string, fingerprint: string): Promise<Receipt | null> {
    const row = await this.db.prepare("SELECT fingerprint,receipt FROM mutation_receipts WHERE actor_id=? AND operation=? AND idempotency_key=?")
      .bind(actorId, operation, key).first<{ fingerprint: string; receipt: string | null }>();
    if (!row) return null;
    if (row.fingerprint !== fingerprint) throw new TaskiError("IDEMPOTENCY_CONFLICT");
    if (!row.receipt) throw new TaskiError("INTERNAL_ERROR");
    return JSON.parse(row.receipt) as Receipt;
  }

  async commit(m: Mutation): Promise<Receipt> {
    const t = m.ticket;
    const scope = [m.actor.memberId, m.operation, m.idempotencyKey];
    const statements = [this.db.prepare("INSERT INTO mutation_receipts(actor_id,operation,idempotency_key,fingerprint,created_at) VALUES(?,?,?,?,?)")
      .bind(...scope, m.fingerprint, m.at)];
    if (m.create) {
      statements.push(this.db.prepare(`INSERT INTO tickets(id,prefix,base_url,title,description,status,assignee_id,area_id,type,highlighted,pr_url,version,created_by,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(t.id, t.prefix, t.baseUrl, t.title, t.description, t.status,
        t.assigneeId, t.areaId, t.type, Number(t.highlighted), t.prUrl, t.version, t.createdBy, t.createdAt, t.updatedAt));
    } else {
      // The SQL guard rejects stale versions inside this transaction, even after a concurrent read.
      statements.push(this.db.prepare(`UPDATE tickets SET title=?,description=?,status=?,assignee_id=?,area_id=?,type=?,highlighted=?,pr_url=?,version=?,updated_at=? WHERE id=?`)
        .bind(t.title, t.description, t.status, t.assigneeId, t.areaId, t.type, Number(t.highlighted), t.prUrl,
          t.version, t.updatedAt, t.id));
    }
    if (m.comment) statements.push(this.db.prepare("INSERT INTO comments(id,ticket_id,ticket_version,body,actor,created_at) VALUES(?,?,?,?,?,?)")
      .bind(m.comment.id, t.id, t.version, m.comment.body, auditActor(m.actor), m.at));
    statements.push(this.db.prepare("INSERT INTO activity(ticket_id,ticket_version,actor,changes,created_at) VALUES(?,?,?,?,?)")
      .bind(t.id, t.version, auditActor(m.actor), JSON.stringify(m.changes), m.at));
    const optionalComment = m.comment ? ",'commentId',?" : "";
    statements.push(this.db.prepare(`UPDATE mutation_receipts SET receipt=(SELECT json_object('key',key,'url',url,'version',version,'changed',json(?)${optionalComment}) FROM tickets WHERE id=?)
      WHERE actor_id=? AND operation=? AND idempotency_key=?`).bind(JSON.stringify(Object.keys(m.changes)),
      ...(m.comment ? [m.comment.id] : []), t.id, ...scope));
    try {
      await this.db.batch(statements);
    } catch (error) {
      // Another request may have won, or a response may have been lost after commit.
      // Only a confirmed persisted receipt may turn that failure into success.
      const confirmed = await this.replay(m.actor.memberId, m.operation, m.idempotencyKey, m.fingerprint);
      if (confirmed) return confirmed;
      if (String(error).includes("VERSION_CONFLICT")) throw new TaskiError("VERSION_CONFLICT");
      throw error;
    }
    const result = await this.replay(m.actor.memberId, m.operation, m.idempotencyKey, m.fingerprint);
    if (!result) throw new TaskiError("INTERNAL_ERROR");
    return result;
  }

  async comments(ticketId: string, beforeVersion: number, limit: number): Promise<Comment[]> {
    const { results } = await this.db.prepare("SELECT * FROM comments WHERE ticket_id=? AND ticket_version<? ORDER BY ticket_version DESC LIMIT ?")
      .bind(ticketId, beforeVersion, limit).all<Row>();
    return results.map((row) => ({ id: row.id as string, ticketId: row.ticket_id as string,
      ticketVersion: row.ticket_version as number, body: row.body as string, actor: JSON.parse(row.actor as string) as Actor,
      createdAt: row.created_at as string }));
  }

  async activity(after: number, limit: number): Promise<Activity[]> {
    const { results } = await this.db.prepare(`SELECT a.*,t.key FROM activity a JOIN tickets t ON t.id=a.ticket_id WHERE a.seq>? ORDER BY a.seq LIMIT ?`)
      .bind(after, limit).all<Row>();
    return results.map((row) => ({ seq: row.seq as number, ticketId: row.ticket_id as string,
      ticketKey: row.key as string, ticketVersion: row.ticket_version as number,
      actor: JSON.parse(row.actor as string) as Actor, changes: JSON.parse(row.changes as string) as Record<string, unknown>,
      createdAt: row.created_at as string }));
  }

  async position(): Promise<{ epoch: string; sequence: number }> {
    const row = await this.db.prepare("SELECT epoch,(SELECT COALESCE(MAX(seq),0) FROM activity) AS sequence FROM project_identity WHERE singleton=1")
      .first<{ epoch: string; sequence: number }>();
    if (!row) throw new TaskiError("INTERNAL_ERROR");
    return row;
  }
}
