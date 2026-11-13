import assert from "node:assert/strict";
import test from "node:test";
import { checkHealth } from "../src/application/health.ts";
import { healthResponse } from "../src/adapters/http/health.ts";

test("storage failures become uncached HTTP 503 without leaking internal errors", async () => {
  const report = await checkHealth({ check: async () => { throw new Error("private SQL failure"); } });
  const response = healthResponse(report);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.text();
  assert(!body.includes("SQL"));
  assert.equal(JSON.parse(body).checks.database, "unavailable");
});
