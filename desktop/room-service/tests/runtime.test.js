const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const test = require("node:test");

const { readErpConfiguration, readPrintAgentStatus, restartPrintAgent, suitePaths } = require("../runtime.cjs");

function sandbox() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fioreze-desktop-"));
  return { directory, env: { LOCALAPPDATA: directory } };
}

test("installed unit configuration resolves the live ERP URL without credentials", () => {
  const { directory, env } = sandbox();
  const paths = suitePaths(env);
  fs.mkdirSync(path.dirname(paths.configFile), { recursive: true });
  fs.writeFileSync(paths.configFile, JSON.stringify({
    origin: "https://portal.example.invalid/",
    hotel_slug: "hotel-ficticio",
    hotel_name: "Hotel Ficticio",
  }));
  assert.deepEqual(readErpConfiguration({ env }), {
    url: "https://portal.example.invalid/hotel-ficticio/admin/erp/",
    hotelSlug: "hotel-ficticio",
    hotelName: "Hotel Ficticio",
    source: "installed-config",
  });
  assert.doesNotMatch(fs.readFileSync(paths.configFile, "utf8"), /token|password|secret/i);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("missing unit configuration opens the local setup state instead of an invalid remote route", () => {
  const { directory, env } = sandbox();
  assert.deepEqual(readErpConfiguration({ env }), { url: null, source: "unconfigured" });
  fs.rmSync(directory, { recursive: true, force: true });
});

test("agent status is sanitized and stale status becomes offline", () => {
  const { directory, env } = sandbox();
  const paths = suitePaths(env);
  fs.mkdirSync(path.dirname(paths.suiteExecutable), { recursive: true });
  fs.mkdirSync(path.dirname(paths.agentStatusFile), { recursive: true });
  fs.writeFileSync(paths.suiteExecutable, "fixture");
  fs.writeFileSync(paths.agentStatusFile, JSON.stringify({
    status: "running",
    message: "Aguardando novos pedidos",
    updated_at: "2026-08-04T12:00:00.000Z",
    printer_name: "Impressora de teste",
    token: "nao-deve-sair",
  }));
  const online = readPrintAgentStatus({ env, now: Date.parse("2026-08-04T12:00:05.000Z") });
  assert.equal(online.running, true);
  assert.equal(online.printer_name, "Impressora de teste");
  assert.equal("token" in online, false);
  const offline = readPrintAgentStatus({ env, now: Date.parse("2026-08-04T12:01:00.000Z") });
  assert.equal(offline.running, false);
  assert.equal(offline.status, "offline");
  fs.rmSync(directory, { recursive: true, force: true });
});

test("restart uses a request file while online and a fixed executable while offline", () => {
  const { directory, env } = sandbox();
  const paths = suitePaths(env);
  fs.mkdirSync(path.dirname(paths.suiteExecutable), { recursive: true });
  fs.mkdirSync(path.dirname(paths.agentStatusFile), { recursive: true });
  fs.writeFileSync(paths.suiteExecutable, "fixture");
  fs.writeFileSync(paths.agentStatusFile, JSON.stringify({ status: "running", updated_at: "2026-08-04T12:00:00.000Z" }));
  const online = restartPrintAgent({ env, now: new Date("2026-08-04T12:00:05.000Z") });
  assert.equal(online.action, "restart_requested");
  assert.equal(fs.existsSync(paths.restartRequestFile), true);

  fs.writeFileSync(paths.agentStatusFile, JSON.stringify({ status: "stopped", updated_at: "2026-08-04T11:00:00.000Z" }));
  let invocation;
  const offline = restartPrintAgent({
    env,
    now: new Date("2026-08-04T12:00:05.000Z"),
    spawnProcess(executable, args, options) {
      invocation = { executable, args, options };
      return { unref() {} };
    },
  });
  assert.equal(offline.action, "started");
  assert.equal(invocation.executable, paths.suiteExecutable);
  assert.deepEqual(invocation.args, ["--tray"]);
  assert.equal(invocation.options.shell, false);
  fs.rmSync(directory, { recursive: true, force: true });
});
