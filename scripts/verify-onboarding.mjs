// Re-run the documented local setup from committed HEAD in an isolated clone.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir, platform, arch } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const environment = { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" };

async function run(command, args, cwd) {
  const child = spawn(command, args, { cwd, env: environment, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(
      `${command} ${args.join(" ")} failed (${code})\n${output.slice(-8000)}`,
    )));
  });
  console.log(`OK: ${command} ${args.join(" ")}`);
  return output.trim();
}

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function verifyServer(cwd) {
  const port = await unusedPort();
  // Start the CLI directly so cleanup owns this process, not an npm wrapper.
  const script = path.join(cwd, "node_modules/wrangler/bin/wrangler.js");
  const child = spawn(process.execPath, [script, "dev", "--local", "--port", String(port)], {
    cwd, env: environment, stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  let startupError;
  child.stdout.on("data", (chunk) => { logs += chunk; });
  child.stderr.on("data", (chunk) => { logs += chunk; });
  child.on("error", (error) => { startupError = error; });
  const closed = new Promise((resolve) => child.once("close", resolve));
  try {
    const deadline = Date.now() + 30_000;
    while (true) {
      if (startupError) throw startupError;
      if (child.exitCode !== null) throw new Error(`Worker exited\n${logs}`);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).checks.database, "ok");
        break;
      } catch (error) {
        if (Date.now() >= deadline) throw new Error(`Health check failed\n${logs}`, { cause: error });
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
    console.log("OK: local /health HTTP 200, D1 ready");
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGINT");
      const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
      try { await closed; } finally { clearTimeout(timeout); }
    }
  }
}

assert.equal(await run("git", ["status", "--porcelain"], root), "",
  "Commit or preserve your changes before verifying committed HEAD; nothing was modified.");
const commit = await run("git", ["rev-parse", "HEAD"], root);
const temporary = await mkdtemp(path.join(tmpdir(), "taski-onboarding-"));
const checkout = path.join(temporary, "taski");
try {
  await run("git", ["clone", "--quiet", "--no-hardlinks", "--no-checkout", root, checkout], temporary);
  await run("git", ["checkout", "--quiet", commit], checkout);
  await run(npm, ["ci"], checkout);
  await run(npm, ["run", "db:migrate"], checkout);
  assert.match(await run(npm, ["run", "db:check"], checkout), /bootstrap_version/);
  await run(npm, ["run", "check"], checkout);
  await run(npm, ["run", "docs:check"], checkout);
  await verifyServer(checkout);
  await verifyServer(checkout);
  await run("git", ["diff", "--check"], checkout);
  assert.equal(await run("git", ["status", "--porcelain"], checkout), "");
  console.log(JSON.stringify({
    status: "PASS", kind: "automated clean checkout; not an independent human review",
    commit, node: process.version, npm: await run(npm, ["--version"], checkout),
    platform: platform(), architecture: arch(), starts: 2,
    database: "local bootstrap_version 1", health: "HTTP 200 across restart",
  }, null, 2));
} finally {
  // Only this script's new clone is removed; the caller's checkout/state is untouched.
  await rm(temporary, { recursive: true, force: true });
}
