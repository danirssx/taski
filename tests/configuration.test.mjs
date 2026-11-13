import assert from "node:assert/strict";
import test from "node:test";
import { demoPreset } from "../src/config/presets/demo.ts";
import { studioPreset } from "../src/config/presets/studio.ts";
import { ConfigurationError, parseConfiguration } from "../src/config/schema.ts";

test("independent presets validate without shared mutable state", () => {
  const a = parseConfiguration(demoPreset);
  const b = parseConfiguration(studioPreset);
  assert.notEqual(a.project.id, b.project.id);
  assert.notEqual(a.project.prefix, b.project.prefix);
  assert.notEqual(a.brand.accentLight, b.brand.accentLight);
  assert(Object.isFrozen(a.members[0]));
  assert.throws(() => { a.members[0].name = "changed"; }, TypeError);
  const source = structuredClone(demoPreset);
  const parsed = parseConfiguration(source);
  source.members[0].name = "changed";
  assert.notEqual(parsed.members[0].name, source.members[0].name);
});

test("display names and labels change without changing stable references", () => {
  const source = structuredClone(demoPreset);
  source.members[0].name = "Renamed";
  source.statusLabels.todo = "Por comenzar";
  source.areas[0].label = "Entrada";
  source.configVersion += 1;
  const parsed = parseConfiguration(source);
  assert.equal(parsed.members[0].id, demoPreset.members[0].id);
  assert.equal(parsed.defaultAreaId, demoPreset.defaultAreaId);
  assert.equal(parsed.project.prefix, demoPreset.project.prefix);
  assert.equal(parsed.configVersion, 2);
});

test("invalid IDs, cross references, labels and unknown fields fail with field paths", () => {
  const cases = [
    ["members[1].id", (v) => { v.members[1].id = v.members[0].id; }],
    ["areas[1].id", (v) => { v.areas[1].id = v.areas[0].id; }],
    ["defaultAreaId", (v) => { v.defaultAreaId = "missing"; }],
    ["project.prefix", (v) => { v.project.prefix = "bad prefix"; }],
    ["project.id", (v) => { v.project.id = "../other"; }],
    ["members[0].defaultView", (v) => { v.members[0].defaultView = "admin"; }],
    ["configVersion", (v) => { v.configVersion = 0; }],
    ["schemaVersion", (v) => { v.schemaVersion = 2; }],
    ["statusLabels.todo", (v) => { delete v.statusLabels.todo; }],
    ["config.accessCode", (v) => { v.accessCode = "not-a-config-secret"; }],
    ["brand.accentLight", (v) => { v.brand.accentLight = "url(bad)"; }],
    ["policy.agentsCanComplete", (v) => { v.policy.agentsCanComplete = "false"; }],
  ];
  for (const [path, mutate] of cases) {
    const value = structuredClone(demoPreset);
    mutate(value);
    assert.throws(() => parseConfiguration(value), (e) => e instanceof ConfigurationError && e.message.includes(path));
  }
});

test("public URL excludes embedded credentials and non-local HTTP", () => {
  for (const baseUrl of ["http://example.com", "https://user:pass@example.com", "https://example.com?x=1",
                         "javascript:alert(1)", "https://example.com/#fragment"]) {
    assert.throws(() => parseConfiguration({ ...demoPreset, project: { ...demoPreset.project, baseUrl } }), ConfigurationError);
  }
  const result = parseConfiguration({ ...demoPreset, project: { ...demoPreset.project, baseUrl: "https://demo.example/taski/" } });
  assert.equal(result.project.baseUrl, "https://demo.example/taski");
});
