import { TaskiError, record, text } from "../../domain/ticket.ts";
import type { Actor } from "../../domain/ticket.ts";
import type { InstallationConfig } from "../../config/types.ts";
import { runtime } from "../worker/runtime.ts";
import { jsonBody, sameOrigin } from "../http/body.ts";

export interface AccessEnvironment { DB: D1Database; TASKI_TEAM_ACCESS_CODE?: string }
const cookieName = "taski_session";
const ttl = 7 * 24 * 60 * 60 * 1000;

export class TeamAccess {
  readonly env: AccessEnvironment;
  readonly config: InstallationConfig;
  readonly now: () => number;
  constructor(env: AccessEnvironment, config: InstallationConfig, now = Date.now) { this.env = env; this.config = config; this.now = now; }

  protected code(): string {
    const code = this.env.TASKI_TEAM_ACCESS_CODE;
    if (typeof code !== "string" || !code.length || code.length > 256) throw new TaskiError("CONFIGURATION_REQUIRED");
    return code;
  }
  protected actor(memberId: string, channel: Actor["channel"], kind: Actor["kind"], client: string): Actor {
    const member = this.config.members.find((entry) => entry.id === memberId);
    if (!member) throw new TaskiError("UNKNOWN_MEMBER");
    return { memberId, name: member.name, channel, kind, client: text(client, "client", 80), identityAssurance: "self_selected" };
  }
  private token(request: Request): string | null {
    const value = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
  }
  private cookie(request: Request, token: string, age: number): string {
    return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
  }
  protected async verifyCode(request: Request, supplied: unknown): Promise<void> {
    const configured = this.code();
    const bucket = await runtime.hash(`access:${request.headers.get("cf-connecting-ip") ?? "local"}`);
    const now = this.now();
    const attempt = await this.env.DB.prepare("SELECT attempts,reset_at FROM access_attempts WHERE bucket=?").bind(bucket)
      .first<{ attempts: number; reset_at: number }>();
    if (attempt && attempt.reset_at > now && attempt.attempts >= 10) throw new TaskiError("RATE_LIMITED");
    const candidate = typeof supplied === "string" && supplied.length <= 256 ? supplied : "";
    const expected = await runtime.hash(configured), actual = await runtime.hash(candidate);
    let difference = 0;
    for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
    if (difference !== 0) {
      const row = await this.env.DB.prepare(`INSERT INTO access_attempts(bucket,attempts,reset_at) VALUES(?,1,?)
        ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,
          reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING attempts`)
        .bind(bucket, now + 60000, now, now).first<{ attempts: number }>();
      throw new TaskiError(row && row.attempts >= 10 ? "RATE_LIMITED" : "AUTH_FAILED");
    }
  }
  private async sessionHash(request: Request): Promise<string> {
    const token = this.token(request);
    if (!token) throw new TaskiError("AUTH_REQUIRED");
    return runtime.hash(`session:${token}`);
  }
  async sessionActor(request: Request): Promise<Actor> {
    const codeFingerprint = await runtime.hash(this.code());
    const hash = await this.sessionHash(request);
    const row = await this.env.DB.prepare("SELECT member_id,code_fingerprint,expires_at FROM team_sessions WHERE token_hash=?")
      .bind(hash).first<{ member_id: string; code_fingerprint: string; expires_at: number }>();
    if (!row || row.expires_at <= this.now() || row.code_fingerprint !== codeFingerprint) throw new TaskiError("AUTH_REQUIRED");
    return this.actor(row.member_id, "web", "person", "taski-web");
  }
  private async createSession(request: Request, memberId: string, previousHash?: string): Promise<Response> {
    const actor = this.actor(memberId, "web", "person", "taski-web");
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const statements = [this.env.DB.prepare("DELETE FROM team_sessions WHERE expires_at<=?").bind(this.now()),
      this.env.DB.prepare("INSERT INTO team_sessions(token_hash,member_id,code_fingerprint,expires_at,created_at) VALUES(?,?,?,?,?)")
        .bind(await runtime.hash(`session:${token}`), actor.memberId, await runtime.hash(this.code()), this.now() + ttl, this.now())];
    if (previousHash) statements.push(this.env.DB.prepare("DELETE FROM team_sessions WHERE token_hash=?").bind(previousHash));
    await this.env.DB.batch(statements);
    return Response.json({ member: { id: actor.memberId, name: actor.name }, identityAssurance: actor.identityAssurance }, {
      headers: { "set-cookie": this.cookie(request, token, ttl / 1000), "cache-control": "no-store" },
    });
  }
  async handle(request: Request): Promise<Response> {
    if (request.method === "POST") {
      sameOrigin(request);
      const args = record(await jsonBody(request, 4096), ["code", "memberId"]);
      await this.verifyCode(request, args.code);
      return this.createSession(request, text(args.memberId, "memberId", 48));
    }
    if (request.method === "GET") {
      const actor = await this.sessionActor(request);
      return Response.json({ member: { id: actor.memberId, name: actor.name }, identityAssurance: actor.identityAssurance }, { headers: { "cache-control": "no-store" } });
    }
    if (request.method === "PUT") {
      sameOrigin(request); await this.sessionActor(request);
      const args = record(await jsonBody(request, 4096), ["memberId"]);
      return this.createSession(request, text(args.memberId, "memberId", 48), await this.sessionHash(request));
    }
    if (request.method === "DELETE") {
      sameOrigin(request);
      await this.env.DB.prepare("DELETE FROM team_sessions WHERE token_hash=?").bind(await this.sessionHash(request)).run();
      return new Response(null, { status: 204, headers: { "set-cookie": this.cookie(request, "", 0), "cache-control": "no-store" } });
    }
    return new Response(null, { status: 405, headers: { allow: "GET, POST, PUT, DELETE" } });
  }
}
