import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createTestHarness } from "wrangler";
import { TaskiClient, TaskiClientError } from "../src/client/index.ts";

const code = "client-test-only-code";
const server = createTestHarness({ workers: [{ configPath: "./wrangler.jsonc", vars: { TASKI_TEAM_ACCESS_CODE: code } }] });
let client;
before(async () => {
  const { url } = await server.listen(); await server.getWorker().applyD1Migrations("DB");
  client = new TaskiClient({ baseUrl: url.origin, code, memberId: "alex", fetch: (url, init) => server.fetch(url, init) });
});
after(() => server.close());

test("independent TypeScript client completes project/create/assign/comment/PR/review against real API", async () => {
  const project = await client.getProject();
  assert.equal((await client.getProject(project.configVersion)).notModified, true);
  const created = await client.createTicket({ title: "SDK workflow", assigneeId: "sam", idempotencyKey: "sdk-create" });
  const progress = await client.updateTicket(created.key, { expectedVersion: 1, idempotencyKey: "sdk-progress", changes: { status: "in_review" }, comment: "Ready" });
  const linked = await client.linkPullRequest(created.key, { expectedVersion: progress.version, idempotencyKey: "sdk-pr", url: "https://github.com/example/demo/pull/1" });
  const detail = await client.getTicket(created.key, { view: "full" });
  assert.equal(detail.ticket.assigneeId, "sam"); assert.equal(detail.ticket.version, linked.version);
  assert.equal(detail.comments[0].body, "Ready"); assert.equal(detail.ticket.prUrl, "https://github.com/example/demo/pull/1");
  const listed = await client.listTickets({ view: "work", assigneeId: "sam" }); assert.equal(listed.items[0].type, "task");
  assert((await client.listActivity({ cursor: project.activityCursor })).items.length >= 3);
  assert(!JSON.stringify(client).includes(code));
  await assert.rejects(client.updateTicket(created.key, { expectedVersion: 1, idempotencyKey: "stale", changes: { title: "Stale" } }), (e) => e instanceof TaskiClientError && e.status === 409 && e.code === "VERSION_CONFLICT");
});

test("client preserves unconfirmed writes and does not silently retry", async () => {
  let calls = 0;
  const broken = new TaskiClient({ baseUrl: "https://taski.example", fetch: async () => {
    calls++; return { ok: false, status: 503, json: async () => ({ error: { code: "UNAVAILABLE", message: "Try later" } }) };
  } });
  await assert.rejects(broken.createTicket({ title: "No retry", idempotencyKey: "same-key" }), { code: "UNAVAILABLE", status: 503 });
  assert.equal(calls, 1);
});
