import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createTestHarness } from "wrangler";

const code = "api-test-only-code";
const server = createTestHarness({ workers: [{ configPath: "./wrangler.jsonc", vars: { TASKI_TEAM_ACCESS_CODE: code } }] });
const headers = { authorization: `Bearer ${code}`, "x-taski-member": "alex", "content-type": "application/json" };
const send = (path, method = "GET", body, extra = {}) => server.fetch(`/api/v1/${path}`, { method, headers: { ...headers, ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
before(async () => { await server.listen(); await server.getWorker().applyD1Migrations("DB"); });
after(() => server.close());

test("protected API creates and assigns; work reads include full text and recent comments", async () => {
  assert.equal((await server.fetch("/api/v1/tickets")).status, 401);
  const response = await send("tickets", "POST", { title: "API ticket", description: "Long ".repeat(2000), assigneeId: "sam", idempotencyKey: "api-create" });
  assert.equal(response.status, 201); const r = await response.json();
  const update = await send(`tickets/${r.key}`, "PATCH", { expectedVersion: 1, idempotencyKey: "api-update", changes: { status: "in_review" }, comment: "Ready" });
  assert.equal(update.status, 200);
  const work = await (await send(`tickets/${r.key}`)).json();
  assert.equal(work.ticket.description.length, 10000); assert.equal(work.comments[0].body, "Ready");
  assert.equal(work.ticket.assigneeId, "sam"); assert.equal(work.ticket.status, "in_review");
  const list = await (await send("tickets")).json();
  assert.equal(list.items.length, 1); assert(!("description" in list.items[0])); assert.equal(list.nextCursor, null);
  const forbidden = await send(`tickets/${r.key}`, "PATCH", { expectedVersion: 2, idempotencyKey: "api-close", changes: { status: "done" } });
  assert.equal(forbidden.status, 403); assert.equal((await forbidden.json()).error.code, "REVIEW_REQUIRED");
});

test("project caching and cursor-only pagination avoid repeating known data", async () => {
  const project = await (await send("project")).json();
  const cached = await (await send(`project?knownVersion=${project.configVersion}`)).json();
  assert.equal(cached.notModified, true); assert(!("project" in cached));
  for (let n = 0; n < 4; n++) await send("tickets", "POST", { title: `Page ${n}`, assigneeId: "sam", idempotencyKey: `page-${n}` });
  const first = await (await send("tickets?limit=2&assigneeId=sam")).json();
  const all = [...first.items]; let next = first.nextCursor;
  while (next) { const page = await (await send(`tickets?limit=2&cursor=${encodeURIComponent(next)}`)).json(); all.push(...page.items); next = page.nextCursor; }
  assert.equal(new Set(all.map((t) => t.key)).size, 5);
  const events = await (await send(`activity?cursor=${encodeURIComponent(project.activityCursor)}`)).json();
  assert.equal(events.items.length, 4);
  const empty = await (await send(`activity?cursor=${encodeURIComponent(events.nextCursor)}`)).json(); assert.deepEqual(empty.items, []);
  const stale = await send(`tickets?cursor=${encodeURIComponent(first.nextCursor)}`);
  assert.equal(stale.status, 200); // no write happened since the list snapshot
  await send("tickets", "POST", { title: "Invalidate snapshot", idempotencyKey: "snapshot" });
  assert.equal((await send(`tickets?cursor=${encodeURIComponent(first.nextCursor)}`)).status, 400);
});

test("older comments page without loss; invalid cursors and stale writes are explicit", async () => {
  const r = await (await send("tickets", "POST", { title: "Conversation", idempotencyKey: "conversation" })).json();
  for (let n = 0; n < 7; n++) {
    const response = await send(`tickets/${r.key}/comments`, "POST", { body: `Comment ${n}`, expectedVersion: n + 1, idempotencyKey: `comment-${n}` });
    assert.equal(response.status, 200);
  }
  const first = await (await send(`tickets/${r.key}?commentsLimit=3`)).json();
  const ids = new Set(first.comments.map((c) => c.id)); let cursor = first.nextCommentsCursor;
  while (cursor) { const page = await (await send(`tickets/${r.key}?commentsLimit=3&commentsCursor=${encodeURIComponent(cursor)}`)).json(); for (const c of page.comments) ids.add(c.id); cursor = page.nextCommentsCursor; }
  assert.equal(ids.size, 7);
  assert.equal((await send("activity?cursor=broken")).status, 400);
  const conflict = await send(`tickets/${r.key}`, "PATCH", { expectedVersion: 1, idempotencyKey: "conflict", changes: { title: "Stale" } });
  assert.equal(conflict.status, 409);
  const bad = await send(`tickets/${r.key}`, "PATCH", { key: "another", expectedVersion: 8, idempotencyKey: "inject", changes: { title: "Bad" } });
  assert.equal(bad.status, 400);
});
