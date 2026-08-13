import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd(), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("ERP application version is shared with the Windows package", () => {
  const config = read("app/public/js/modules/room-service-erp/static-config.js");
  const packageJson = JSON.parse(read("desktop/room-service/package.json"));
  const match = config.match(/ERP_APP_VERSION\s*=\s*"([^"]+)"/);

  assert.ok(match, "ERP_APP_VERSION must be declared");
  assert.equal(match[1], packageJson.version);
  assert.match(match[1], /^\d+\.\d+\.\d+$/);
});

test("settings expose installed ERP and Fioreze Suite versions", () => {
  const app = read("app/public/js/modules/room-service-erp/legacy-app.js");
  const adapter = read("app/public/js/modules/room-service-erp/desktop-adapter.js");

  assert.match(app, /settingsCard\("version", "version", "Versão do aplicativo"/);
  assert.match(app, /renderApplicationVersionSettings/);
  assert.match(app, /id="checkApplicationUpdatesButton"/);
  assert.match(app, /Fioreze ERP/);
  assert.match(app, /Fioreze Suite/);
  assert.match(app, /desktop\.checkForUpdates\(\)/);
  assert.match(adapter, /checkForUpdates\(\)/);
  assert.match(adapter, /window\.fiorezeDesktop\?\.checkForUpdates/);
});

test("version check uses the protected same-origin Suite manifest", () => {
  const app = read("app/public/js/modules/room-service-erp/legacy-app.js");
  const manifestFunction = app.match(/async function fetchSuiteReleaseManifest\(\)[\s\S]*?\n}/)?.[0] || "";

  assert.match(manifestFunction, /fetch\("\/downloads\/print-agent\/latest\.json"/);
  assert.match(manifestFunction, /cache:\s*"no-store"/);
  assert.match(app, /\^\\d\+\\\.\\d\+\\\.\\d\+/);
  assert.match(app, /A versão web é atualizada automaticamente/);
  assert.doesNotMatch(manifestFunction, /token|password|secret/i);
});
