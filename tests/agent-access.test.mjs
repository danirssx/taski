import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createTestHarness } from "wrangler";
import { TeamAccess } from "../src/adapters/access/team-access.ts";
import { demoPreset } from "../src/config/presets/demo.ts";

const server = createTestHarness({ workers: [{ configPath: "./wrangler.jsonc" }] });
let env;
const code = "synthetic-agent-code";
const request = (headers = {}) => new Request("https://taski.example/mcp", { headers });
const headers = { authorization: `Bearer ${code}`, "x-taski-member": "alex", "x-taski-client": "test-agent" };
before(async () => { await server.listen(); await server.getWorker().applyD1Migrations("DB"); env = { ...(await server.getWorker().getEnv()), TASKI_TEAM_ACCESS_CODE: code }; });
after(() => server.close());

test("header access builds declared actors and distinguishes channel from role", async () => {
  const access = new TeamAccess(env, demoPreset);
  const http = await access.authenticate(request(headers), "http");
  const mcp = await access.authenticate(request(headers), "mcp");
  assert.equal(http.kind, "agent"); assert.equal(mcp.kind, "agent");
  assert.equal(http.memberId, mcp.memberId); assert.equal(http.channel, "http"); assert.equal(mcp.channel, "mcp");
  assert.equal(mcp.identityAssurance, "self_selected"); assert(!JSON.stringify(mcp).includes(code));
  await assert.rejects(access.authenticate(request(), "mcp"), { code: "AUTH_REQUIRED" });
  await assert.rejects(access.authenticate(request({ ...headers, authorization: "Bearer wrong" }), "mcp"), { code: "AUTH_FAILED" });
  await assert.rejects(access.authenticate(request({ ...headers, "x-taski-member": "missing" }), "mcp"), { code: "UNKNOWN_MEMBER" });
});

test("completion delegation comes only from server configuration, not client headers", async () => {
  const access = new TeamAccess({ ...env, TASKI_AGENT_COMPLETION_GRANTS: JSON.stringify({ reference: "maintainer-task-001", members: { alex: ["DEMO-001"] } }) }, demoPreset);
  const actor = await access.authenticate(request({ ...headers, "x-taski-completion-for": "DEMO-999" }), "mcp");
  assert.deepEqual(actor.completionFor, ["DEMO-001"]); assert.equal(actor.authorizationRef, "maintainer-task-001");
  assert.equal(demoPreset.policy.agentsCanComplete, false);
  const noGrants = await new TeamAccess(env, demoPreset).authenticate(request({ ...headers, "x-taski-completion-for": "DEMO-999" }), "mcp");
  assert.equal(noGrants.completionFor, undefined);
});

test("code rotation invalidates old web sessions and agent credentials", async () => {
  const access = new TeamAccess(env, demoPreset);
  const response = await access.handle(new Request("https://taski.example/api/v1/session", { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify({ code, memberId: "alex" }) }));
  const cookie = response.headers.get("set-cookie").split(";")[0];
  assert.match(response.headers.get("set-cookie"), /; Secure/);
  const rotated = new TeamAccess({ ...env, TASKI_TEAM_ACCESS_CODE: "rotated-synthetic-code" }, demoPreset);
  await assert.rejects(rotated.sessionActor(request({ cookie })), { code: "AUTH_REQUIRED" });
  await assert.rejects(rotated.authenticate(request(headers), "mcp"), { code: "AUTH_FAILED" });
  await assert.rejects(new TeamAccess({ ...env, TASKI_TEAM_ACCESS_CODE: undefined }, demoPreset).authenticate(request(headers), "mcp"), { code: "CONFIGURATION_REQUIRED" });
});
