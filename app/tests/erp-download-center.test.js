import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";

const ERP_MANIFEST = [
  "version: 1.2.2",
  "files:",
  "  - url: Fioreze-ERP-Setup-1.2.2.exe",
  "    sha512: test",
  "    size: 3",
  "path: Fioreze-ERP-Setup-1.2.2.exe",
  "sha512: test",
].join("\n");

const SUITE_MANIFEST = JSON.stringify({
  schema_version: 1,
  version: "1.5.0",
  file: "Fioreze-Suite-1.5.0.exe",
  sha256: "a".repeat(64),
  size_bytes: 3,
});

async function publishDesktopFixtures(env) {
  await env.MEDIA_BUCKET.put("desktop/erp/releases/latest.yml", ERP_MANIFEST);
  await env.MEDIA_BUCKET.put("desktop/erp/releases/Fioreze-ERP-Setup-1.2.2.exe", new Uint8Array([0x4d, 0x5a, 0x01]));
  await env.MEDIA_BUCKET.put("desktop/erp/releases/Fioreze-ERP-Setup-1.2.2.exe.blockmap", new Uint8Array([0x01, 0x02]));
  await env.MEDIA_BUCKET.put("desktop/print-agent/releases/latest.json", SUITE_MANIFEST);
  await env.MEDIA_BUCKET.put("desktop/print-agent/releases/Fioreze-Suite-1.5.0.exe", new Uint8Array([0x4d, 0x5a, 0x02]));
}

test("internal download center unifies the latest ERP and Suite releases", async () => {
  const { env, fetch } = createWorkerTestContext();
  await publishDesktopFixtures(env);

  const page = await fetch("/internal/download");
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);
  assert.equal(page.headers.get("cache-control"), "no-store");
  assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow");

  const html = await page.text();
  assert.match(html, /Central de downloads/);
  assert.match(html, /Fioreze ERP/);
  assert.match(html, /Versão 1\.2\.2/);
  assert.match(html, /Fioreze-ERP-Setup-1\.2\.2\.exe/);
  assert.match(html, /\/internal\/download\/erp/);
  assert.match(html, /Fioreze Suite/);
  assert.match(html, /Versão 1\.5\.0/);
  assert.match(html, /Fioreze-Suite-1\.5\.0\.exe/);
  assert.match(html, /\/internal\/download\/suite/);
  assert.doesNotMatch(html, /\/downloads\/(?:erp|print-agent)\/(?:download|installer)/);
  assert.doesNotMatch(html, /latest\.(?:yml|json)/);

  const erpInstaller = await fetch("/internal/download/erp");
  assert.equal(erpInstaller.status, 200);
  assert.equal(erpInstaller.headers.get("content-type"), "application/vnd.microsoft.portable-executable");
  assert.match(erpInstaller.headers.get("content-disposition"), /Fioreze-ERP-Setup-1\.2\.2\.exe/);
  assert.deepEqual([...new Uint8Array(await erpInstaller.arrayBuffer())], [0x4d, 0x5a, 0x01]);

  const suiteInstaller = await fetch("/internal/download/suite");
  assert.equal(suiteInstaller.status, 200);
  assert.equal(suiteInstaller.headers.get("content-type"), "application/vnd.microsoft.portable-executable");
  assert.match(suiteInstaller.headers.get("content-disposition"), /Fioreze-Suite-1\.5\.0\.exe/);
  assert.deepEqual([...new Uint8Array(await suiteInstaller.arrayBuffer())], [0x4d, 0x5a, 0x02]);

  const head = await fetch("/internal/download", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
});

test("internal download center remains safe when no release is published", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/internal/download");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Indisponível no momento/);
  assert.doesNotMatch(html, /desktop\/(?:erp|print-agent)\/releases/);
});
