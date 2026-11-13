import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createTestHarness } from "wrangler";

// The harness owns isolated ephemeral storage, never the developer's local DB.
const server = createTestHarness({ workers: [{ configPath: "./wrangler.jsonc" }] });
before(() => server.listen());
after(() => server.close());

test("a clean D1 is unavailable until migrations are applied", async () => {
  const response = await server.fetch("/health");
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(data.checks.database, "unavailable");
});

test("real D1 migration is repeatable and makes readiness healthy", async () => {
  const worker = server.getWorker();
  await worker.applyD1Migrations("DB");
  await worker.applyD1Migrations("DB");
  const response = await server.fetch("/health");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const env = await worker.getEnv();
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM taski_bootstrap").first();
  assert.equal(row.n, 1);
});

test("missing bootstrap data causes 503 and can be restored", async () => {
  const env = await server.getWorker().getEnv();
  await env.DB.prepare("DELETE FROM taski_bootstrap WHERE id = 1").run();
  assert.equal((await server.fetch("/health")).status, 503);
  await env.DB.prepare("INSERT INTO taski_bootstrap VALUES (1, 1)").run();
  assert.equal((await server.fetch("/health")).status, 200);
});

test("unknown routes and methods do not expose future APIs", async () => {
  assert.equal((await server.fetch("/api/v1/tickets")).status, 404);
  assert.equal((await server.fetch("/mcp")).status, 404);
  const response = await server.fetch("/health", { method: "POST" });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET");
});

test("reset starts with fresh storage instead of reusing a developer database", async () => {
  await server.reset();
  assert.equal((await server.fetch("/health")).status, 503);
});
