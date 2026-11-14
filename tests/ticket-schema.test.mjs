import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createTestHarness } from "wrangler";

const server = createTestHarness({ workers: [{ configPath: "./wrangler.jsonc" }] });
let db;
before(async () => {
  await server.listen();
  await server.getWorker().applyD1Migrations("DB");
  db = (await server.getWorker().getEnv()).DB;
  await db.prepare("INSERT INTO project_identity(singleton,project_id,prefix) VALUES(1,'demo','DEMO')").run();
});
after(() => server.close());

const create = (id) => db.prepare("INSERT INTO tickets(id,prefix,base_url,title,area_id,created_by) VALUES(?,'DEMO','https://taski.example',?,'general','alex') RETURNING *").bind(id, `Task ${id}`).first();

test("D1 allocates concurrent ticket codes without counting rows", async () => {
  const rows = await Promise.all(Array.from({ length: 12 }, (_, n) => create(`schema-${n}`)));
  assert.equal(new Set(rows.map((r) => r.key)).size, 12);
  assert(rows.every((r) => r.url.endsWith(`/t/${r.key}`)));
});

test("renaming, conversion and reassignment preserve identity and URL", async () => {
  const before = await create("stable");
  await db.prepare("UPDATE tickets SET title='Renamed', type='feedback', assignee_id='sam', version=2 WHERE id='stable'").run();
  const after = await db.prepare("SELECT * FROM tickets WHERE id='stable'").first();
  assert.equal(after.key, before.key);
  assert.equal(after.url, before.url);
  await assert.rejects(db.prepare("UPDATE tickets SET prefix='OTHER',version=3 WHERE id='stable'").run(), /IMMUTABLE_IDENTITY/);
  await assert.rejects(db.prepare("DELETE FROM tickets WHERE id='stable'").run(), /TICKET_DELETE_DISABLED/);
});

test("migration tracks bootstrap, constraints and indexes without team data", async () => {
  await server.getWorker().applyD1Migrations("DB");
  const { results } = await db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'tickets_%'").all();
  assert(results.length >= 4);
  await assert.rejects(db.prepare("UPDATE tickets SET status='invented',version=3 WHERE id='stable'").run());
  await assert.rejects(db.prepare("INSERT INTO tickets(id,prefix,base_url,title,area_id,created_by) VALUES('bad','OTHER','https://taski.example','Bad','general','alex')").run(), /PROJECT_IDENTITY_CONFLICT/);
});
