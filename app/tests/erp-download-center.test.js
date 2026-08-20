import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";

const MANIFEST = [
  "version: 1.2.0",
  "files:",
  "  - url: Fioreze-ERP-Setup-1.2.0.exe",
  "    sha512: test",
  "    size: 3",
  "path: Fioreze-ERP-Setup-1.2.0.exe",
  "sha512: test",
].join("\n");

test("ERP download center exposes the current Windows installer from the updater manifest", async () => {
  const { env, fetch } = createWorkerTestContext();
  await env.MEDIA_BUCKET.put("desktop/erp/releases/latest.yml", MANIFEST);
  await env.MEDIA_BUCKET.put("desktop/erp/releases/Fioreze-ERP-Setup-1.2.0.exe", new Uint8Array([0x4d, 0x5a, 0x01]));
  await env.MEDIA_BUCKET.put("desktop/erp/releases/Fioreze-ERP-Setup-1.2.0.exe.blockmap", new Uint8Array([0x01, 0x02]));

  const page = await fetch("/downloads/erp/download");
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);
  assert.equal(page.headers.get("cache-control"), "no-store");
  const html = await page.text();
  assert.match(html, /Fioreze ERP/);
  assert.match(html, /Versao 1\.2\.0/);
  assert.match(html, /\/downloads\/erp\/installer/);
  assert.match(html, /Fioreze-ERP-Setup-1\.2\.0\.exe/);
  assert.match(html, /Fioreze-ERP-Setup-1\.2\.0\.exe\.blockmap/);

  const installer = await fetch("/downloads/erp/installer");
  assert.equal(installer.status, 200);
  assert.equal(installer.headers.get("content-type"), "application/vnd.microsoft.portable-executable");
  assert.match(installer.headers.get("content-disposition"), /Fioreze-ERP-Setup-1\.2\.0\.exe/);
  assert.deepEqual([...new Uint8Array(await installer.arrayBuffer())], [0x4d, 0x5a, 0x01]);

  const head = await fetch("/downloads/erp/installer", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
});

test("ERP download center reports an unavailable release without exposing storage internals", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/downloads/erp/download");
  assert.equal(response.status, 503);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.doesNotMatch(await response.text(), /desktop\/erp\/releases/);
});
