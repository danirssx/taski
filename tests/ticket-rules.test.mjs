import assert from "node:assert/strict";
import test from "node:test";
import { TicketService } from "../src/application/tickets.ts";
import { demoPreset } from "../src/config/presets/demo.ts";

// Test double only. Production persistence is implemented by the D1 adapter.
function fixture() {
  const rows = new Map(); let sequence = 0; let ids = 0;
  const repo = {
    initialize: async () => {}, replay: async () => null,
    get: async (key) => rows.get(key) ?? [...rows.values()].find((t) => t.id === key) ?? null,
    list: async () => [...rows.values()],
    commit: async (m) => {
      const previous = [...rows.values()].find((t) => t.id === m.ticket.id);
      const number = previous?.number ?? ++sequence;
      const key = previous?.key ?? `DEMO-${String(number).padStart(3, "0")}`;
      const url = previous?.url ?? `https://taski.example/t/${key}`;
      rows.set(key, { ...m.ticket, number, key, url });
      return { key, url, version: m.ticket.version, changed: Object.keys(m.changes) };
    },
  };
  const service = new TicketService(repo, demoPreset, { id: () => `id-${++ids}`, now: () => new Date().toISOString(), hash: async (s) => s });
  const actor = { memberId: "alex", name: "untrusted", kind: "agent", channel: "mcp", client: "rules-test", identityAssurance: "self_selected" };
  return { service, rows, actor };
}

test("conversion and highlight retain identity and do not change workflow", async () => {
  const { service, actor } = fixture();
  const receipt = await service.create({ title: "Feedback", type: "feedback", assigneeId: "sam", idempotencyKey: "create" }, actor);
  const before = await service.get(receipt.key);
  await service.update({ key: receipt.key, expectedVersion: 1, idempotencyKey: "convert", changes: { type: "task", highlighted: true } }, actor);
  const after = await service.get(receipt.key);
  assert.equal(before.id, after.id); assert.equal(before.url, after.url);
  assert.equal(after.status, "todo"); assert.equal(after.assigneeId, "sam");
  assert.equal(after.type, "task"); assert.equal(after.highlighted, true);
});

test("members, areas and immutable fields are validated before writes", async () => {
  const { service, actor, rows } = fixture();
  for (const fields of [{ assigneeId: "missing" }, { areaId: "missing" }, { id: "injected" }, { status: "invented" }, { title: " " }]) {
    await assert.rejects(service.create({ title: "Task", idempotencyKey: "bad", ...fields }, actor));
  }
  assert.equal(rows.size, 0);
  await assert.rejects(service.create({ title: "Task", idempotencyKey: "bad" }, { ...actor, memberId: "missing" }), { code: "UNKNOWN_MEMBER" });
});

test("agents go to review; trusted scoped delegation does not change global policy", async () => {
  const { service, actor } = fixture();
  const receipt = await service.create({ title: "Task", idempotencyKey: "create" }, actor);
  const update = { key: receipt.key, expectedVersion: 1, idempotencyKey: "done", changes: { status: "done" }, comment: "Done" };
  await assert.rejects(service.update(update, actor), { code: "REVIEW_REQUIRED" });
  assert.equal((await service.get(receipt.key)).version, 1);
  await service.update(update, { ...actor, completionFor: [receipt.key], authorizationRef: "test-grant" });
  assert.equal((await service.get(receipt.key)).status, "done");
  assert.equal(demoPreset.policy.agentsCanComplete, false);
});

test("stale edits, ambiguous patches and empty updates do not modify the ticket", async () => {
  const { service, actor } = fixture();
  const r = await service.create({ title: "Task", description: "same same", idempotencyKey: "create" }, actor);
  await assert.rejects(service.update({ key: r.key, expectedVersion: 2, idempotencyKey: "stale", changes: { title: "Stale" } }, actor), { code: "VERSION_CONFLICT" });
  await assert.rejects(service.update({ key: r.key, expectedVersion: 1, idempotencyKey: "patch", descriptionPatch: { find: "same", replace: "x" } }, actor), { code: "PATCH_CONFLICT" });
  await assert.rejects(service.update({ key: r.key, expectedVersion: 1, idempotencyKey: "empty", changes: {} }, actor), { code: "EMPTY_UPDATE" });
  assert.equal((await service.get(r.key)).description, "same same");
});
