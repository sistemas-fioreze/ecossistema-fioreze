import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";

const MANIFEST = JSON.stringify({
  schema_version: 1,
  version: "1.4.4",
  file: "Fioreze-Suite-1.4.4.exe",
  sha256: "a".repeat(64),
  size_bytes: 3,
});

test("Fioreze Suite download center exposes the current Windows installer", async () => {
  const { env, fetch } = createWorkerTestContext();
  await env.MEDIA_BUCKET.put("desktop/print-agent/releases/latest.json", MANIFEST);
  await env.MEDIA_BUCKET.put("desktop/print-agent/releases/Fioreze-Suite-1.4.4.exe", new Uint8Array([0x4d, 0x5a, 0x02]));

  const page = await fetch("/downloads/print-agent/download");
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);
  assert.equal(page.headers.get("cache-control"), "no-store");
  const html = await page.text();
  assert.match(html, /Fioreze Suite/);
  assert.match(html, /Versao 1\.4\.4/);
  assert.match(html, /\/downloads\/print-agent\/installer/);
  assert.match(html, /Fioreze-Suite-1\.4\.4\.exe/);

  const installer = await fetch("/downloads/print-agent/installer");
  assert.equal(installer.status, 200);
  assert.equal(installer.headers.get("content-type"), "application/vnd.microsoft.portable-executable");
  assert.match(installer.headers.get("content-disposition"), /Fioreze-Suite-1\.4\.4\.exe/);
  assert.deepEqual([...new Uint8Array(await installer.arrayBuffer())], [0x4d, 0x5a, 0x02]);

  const head = await fetch("/downloads/print-agent/installer", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
});

test("Fioreze Suite download center reports an unavailable release safely", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/downloads/print-agent/download");
  assert.equal(response.status, 503);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.doesNotMatch(await response.text(), /desktop\/print-agent\/releases/);
});
