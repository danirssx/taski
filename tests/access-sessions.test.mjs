import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createTestHarness } from "wrangler";

const code = "fictitious-local-test-code";
const server = createTestHarness({ workers: [{ configPath: "./wrangler.jsonc", vars: { TASKI_TEAM_ACCESS_CODE: code } }] });
before(async () => { await server.listen(); await server.getWorker().applyD1Migrations("DB"); });
after(() => server.close());
const send = (method, body, cookie, extra = {}) => server.fetch("/api/v1/session", { method,
  headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...extra },
  ...(body ? { body: JSON.stringify(body) } : {}) });
const cookie = (response) => response.headers.get("set-cookie").split(";")[0];

test("code and selected member create an HttpOnly session; secrets never appear in responses", async () => {
  assert.equal((await send("POST", { code: "wrong", memberId: "alex" })).status, 401);
  assert.equal((await send("POST", { code, memberId: "missing" })).status, 400);
  const response = await send("POST", { code, memberId: "alex" });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  const body = await response.text(); assert(!body.includes(code));
  const current = await send("GET", null, cookie(response));
  assert.equal((await current.json()).member.id, "alex");
  const db = (await server.getWorker().getEnv()).DB;
  const rows = await db.prepare("SELECT * FROM team_sessions").all();
  assert(!JSON.stringify(rows).includes(cookie(response).split("=")[1]));
});

test("changing person rotates and revokes the old session; logout revokes the new one", async () => {
  const first = await send("POST", { code, memberId: "alex" });
  const oldCookie = cookie(first);
  const switched = await send("PUT", { memberId: "sam" }, oldCookie);
  assert.equal((await switched.clone().json()).member.id, "sam");
  assert.equal((await send("GET", null, oldCookie)).status, 401);
  const newCookie = cookie(switched);
  assert.equal((await send("DELETE", null, newCookie)).status, 204);
  assert.equal((await send("GET", null, newCookie)).status, 401);
});

test("origin, malformed input, session expiry and failed-code rate limits are enforced", async () => {
  assert.equal((await send("POST", { code, memberId: "alex" }, null, { origin: "https://other.example" })).status, 403);
  const signed = await send("POST", { code, memberId: "alex" });
  const db = (await server.getWorker().getEnv()).DB;
  await db.prepare("UPDATE team_sessions SET expires_at=0").run();
  assert.equal((await send("GET", null, cookie(signed))).status, 401);
  for (let n = 0; n < 10; n++) await send("POST", { code: "wrong", memberId: "alex" }, null, { "cf-connecting-ip": "192.0.2.50" });
  const limited = await send("POST", { code, memberId: "alex" }, null, { "cf-connecting-ip": "192.0.2.50" });
  assert.equal(limited.status, 429); assert.equal(limited.headers.get("retry-after"), "60");
  const malformed = await server.fetch("/api/v1/session", { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
  assert.equal(malformed.status, 400);
});
