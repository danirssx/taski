import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createTestHarness } from "wrangler";
import { D1TicketRepository } from "../src/adapters/storage/d1-tickets.ts";
import { TicketService } from "../src/application/tickets.ts";
import { runtime } from "../src/adapters/worker/runtime.ts";
import { demoPreset } from "../src/config/presets/demo.ts";

const server = createTestHarness({ workers: [{ configPath: "./wrangler.jsonc" }] });
let db, repo, service;
const actor = { memberId: "alex", name: "wrong-name", kind: "agent", channel: "mcp", client: "audit-test", identityAssurance: "self_selected" };
before(async () => {
  await server.listen(); await server.getWorker().applyD1Migrations("DB");
  db = (await server.getWorker().getEnv()).DB;
  repo = new D1TicketRepository(db); service = new TicketService(repo, demoPreset, runtime);
});
after(() => server.close());

test("D1 atomically stores state, comment and one event with server actor/time", async () => {
  const receipt = await service.create({ title: "Audit test", description: "Before", idempotencyKey: "create-audit" }, actor);
  const r = await service.update({ key: receipt.key, expectedVersion: 1, idempotencyKey: "update-audit",
    changes: { status: "in_review", assigneeId: "sam", highlighted: true }, comment: "Ready" }, actor);
  const ticket = await service.get(r.key);
  assert.equal(ticket.version, 2); assert.equal(ticket.status, "in_review");
  const comments = await repo.comments(ticket.id, 3, 20);
  assert.equal(comments.length, 1); assert.equal(comments[0].body, "Ready");
  const events = await repo.activity(0, 20);
  assert.equal(events.length, 2); assert.equal(events[1].actor.name, "Alex");
  assert.equal(events[1].actor.channel, "mcp"); assert.equal(events[1].actor.identityAssurance, "self_selected");
  assert.deepEqual(events[1].changes.status, { before: "todo", after: "in_review" });
  assert.equal(events[1].changes.commentAdded.id, r.commentId);
  assert.equal(events[1].createdAt, comments[0].createdAt);
});

test("a forced audit failure rolls back ticket, comment and retry reservation", async () => {
  const r = await service.create({ title: "Rollback", idempotencyKey: "rollback-create" }, actor);
  const ticket = await service.get(r.key);
  await db.prepare("CREATE TRIGGER force_audit_failure BEFORE INSERT ON activity BEGIN SELECT RAISE(ABORT,'TEST_AUDIT_FAILURE'); END").run();
  try {
    await assert.rejects(service.update({ key: r.key, expectedVersion: 1, idempotencyKey: "rollback-update",
      changes: { status: "in_review" }, comment: "Must not remain" }, actor), /TEST_AUDIT_FAILURE/);
    assert.equal((await service.get(r.key)).version, 1);
    assert.equal((await repo.comments(ticket.id, 10, 20)).length, 0);
    assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM mutation_receipts WHERE idempotency_key='rollback-update'").first("n"), 0);
  } finally { await db.prepare("DROP TRIGGER force_audit_failure").run(); }
});

test("patch events preserve full content without echoing both descriptions", async () => {
  const r = await service.create({ title: "Patch", description: "Start " + "content ".repeat(1000), idempotencyKey: "patch-create" }, actor);
  await service.update({ key: r.key, expectedVersion: 1, idempotencyKey: "patch-update", descriptionPatch: { find: "Start", replace: "Changed" } }, actor);
  const events = await repo.activity(0, 50);
  const event = events.at(-1);
  assert.deepEqual(event.changes.description, { patch: { find: "Start", replace: "Changed" } });
  assert((await service.get(r.key)).description.endsWith("content "));
  await assert.rejects(db.prepare("DELETE FROM activity WHERE seq=?").bind(event.seq).run(), /AUDIT_APPEND_ONLY/);
});
