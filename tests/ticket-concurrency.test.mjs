import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createTestHarness } from "wrangler";
import { D1TicketRepository } from "../src/adapters/storage/d1-tickets.ts";
import { TicketService } from "../src/application/tickets.ts";
import { runtime } from "../src/adapters/worker/runtime.ts";
import { demoPreset } from "../src/config/presets/demo.ts";

const server = createTestHarness({ workers: [{ configPath: "./wrangler.jsonc" }] });
let db;
const actor = { memberId: "alex", name: "Alex", kind: "agent", channel: "mcp", client: "race-test", identityAssurance: "self_selected" };
const service = (context = demoPreset, repo = new D1TicketRepository(db)) => new TicketService(repo, context, runtime);
before(async () => { await server.listen(); await server.getWorker().applyD1Migrations("DB"); db = (await server.getWorker().getEnv()).DB; });
after(() => server.close());

test("sixteen concurrent identical creates persist one ticket and return the same receipt", async () => {
  const input = { title: "Concurrent retry", idempotencyKey: "same-create" };
  const receipts = await Promise.all(Array.from({ length: 16 }, () => service().create(input, actor)));
  assert(receipts.every((r) => JSON.stringify(r) === JSON.stringify(receipts[0])));
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE title='Concurrent retry'").first("n"), 1);
  const ticket = await service().get(receipts[0].key);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM activity WHERE ticket_id=?").bind(ticket.id).first("n"), 1);
  await assert.rejects(service().create({ ...input, title: "Different" }, actor), { code: "IDEMPOTENCY_CONFLICT" });
});

test("forced stale-read race produces one winner, a typed conflict and no partial comment", async () => {
  const r = await service().create({ title: "Stale race", idempotencyKey: "race-create" }, actor);
  let arrivals = 0, release;
  const gate = new Promise((resolve) => { release = resolve; });
  class RacingRepository extends D1TicketRepository {
    async get(reference) {
      const row = await super.get(reference);
      if (++arrivals === 2) release();
      await gate;
      return row;
    }
  }
  const results = await Promise.allSettled(["A", "B"].map((title) => service(demoPreset, new RacingRepository(db)).update({
    key: r.key, expectedVersion: 1, idempotencyKey: `edit-${title}`, changes: { title }, comment: `Advance ${title}`,
  }, actor)));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.find((r) => r.status === "rejected").reason.code, "VERSION_CONFLICT");
  const ticket = await service().get(r.key);
  assert.equal(ticket.version, 2);
  assert.equal((await new D1TicketRepository(db).comments(ticket.id, 10, 20)).length, 1);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM activity WHERE ticket_id=?").bind(ticket.id).first("n"), 2);
});

test("replay returns the original version after later edits and member rename", async () => {
  const input = { title: "Stable replay", idempotencyKey: "stable-create" };
  const first = await service().create(input, actor);
  const update = { key: first.key, expectedVersion: 1, idempotencyKey: "same-update", changes: { highlighted: true }, comment: "One advance" };
  const replies = await Promise.all(Array.from({ length: 8 }, () => service().update(update, actor)));
  assert(replies.every((r) => JSON.stringify(r) === JSON.stringify(replies[0])));
  const context = structuredClone(demoPreset); context.members[0].name = "Renamed"; context.configVersion++;
  assert.deepEqual(await service(context).create(input, { ...actor, client: "new-version" }), first);
  assert.deepEqual(await service().update(update, actor), replies[0]);
  assert.equal((await service().get(first.key)).version, 2);
});

test("failed batch can retry after recovery; another project cannot reuse the database", async () => {
  const input = { title: "Recovered retry", idempotencyKey: "recover-create" };
  await db.prepare("CREATE TRIGGER retry_failure BEFORE INSERT ON activity BEGIN SELECT RAISE(ABORT,'RETRY_TEST_FAILURE'); END").run();
  try { await assert.rejects(service().create(input, actor), /RETRY_TEST_FAILURE/); }
  finally { await db.prepare("DROP TRIGGER retry_failure").run(); }
  const r = await service().create(input, actor);
  assert.equal(r.version, 1);
  assert.equal(await db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE title='Recovered retry'").first("n"), 1);
  const context = structuredClone(demoPreset); context.project.id = "another"; context.project.prefix = "OTHER";
  await assert.rejects(service(context).get(r.key), { code: "PROJECT_IDENTITY_CONFLICT" });
});
