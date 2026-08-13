import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";

test("desktop updater streams only approved release files from private R2", async () => {
  const { env, fetch } = createWorkerTestContext();
  const key = "desktop/erp/releases/Fioreze-ERP-Setup-1.1.7.exe";
  await env.MEDIA_BUCKET.put(key, new Uint8Array([0x4d, 0x5a, 0x01]));
  await env.MEDIA_BUCKET.put("desktop/erp/releases/latest.yml", "version: 1.1.7\n");

  const installer = await fetch("/downloads/erp/Fioreze-ERP-Setup-1.1.7.exe");
  const latest = await fetch("/downloads/erp/latest.yml");
  const head = await fetch("/downloads/erp/Fioreze-ERP-Setup-1.1.7.exe", { method: "HEAD" });

  assert.equal(installer.status, 200);
  assert.equal(installer.headers.get("content-type"), "application/vnd.microsoft.portable-executable");
  assert.match(installer.headers.get("cache-control"), /immutable/);
  assert.deepEqual([...new Uint8Array(await installer.arrayBuffer())], [0x4d, 0x5a, 0x01]);
  assert.equal(latest.status, 200);
  assert.equal(latest.headers.get("cache-control"), "no-store");
  assert.equal(await latest.text(), "version: 1.1.7\n");
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
});

test("desktop release route rejects traversal and unknown artifacts as JSON", async () => {
  const { fetch } = createWorkerTestContext();
  for (const path of [
    "/downloads/erp/arquivo.exe",
    "/downloads/erp/Fioreze-ERP-Setup-1.1.7.zip",
    "/downloads/erp/%2e%2e%2flatest.yml",
  ]) {
    const response = await fetch(path);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.doesNotMatch(await response.text(), /<html/i);
  }
});

test("print agent updater streams only its versioned executable and JSON manifest", async () => {
  const { env, fetch } = createWorkerTestContext();
  const manifest = JSON.stringify({
    schema_version: 1,
    version: "1.4.4",
    file: "Fioreze-Suite-1.4.4.exe",
    sha256: "a".repeat(64),
    size_bytes: 3,
  });
  await env.MEDIA_BUCKET.put("desktop/print-agent/releases/Fioreze-Suite-1.4.4.exe", new Uint8Array([0x4d, 0x5a, 0x02]));
  await env.MEDIA_BUCKET.put("desktop/print-agent/releases/latest.json", manifest);

  const executable = await fetch("/downloads/print-agent/Fioreze-Suite-1.4.4.exe");
  const latest = await fetch("/downloads/print-agent/latest.json");
  const head = await fetch("/downloads/print-agent/Fioreze-Suite-1.4.4.exe", { method: "HEAD" });

  assert.equal(executable.status, 200);
  assert.equal(executable.headers.get("content-type"), "application/vnd.microsoft.portable-executable");
  assert.match(executable.headers.get("cache-control"), /immutable/);
  assert.equal(latest.status, 200);
  assert.equal(latest.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(latest.headers.get("cache-control"), "no-store");
  assert.equal(await latest.text(), manifest);
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
});

test("print agent release route rejects arbitrary and traversed files", async () => {
  const { fetch } = createWorkerTestContext();
  for (const path of [
    "/downloads/print-agent/Fioreze-Suite.exe",
    "/downloads/print-agent/Fioreze-Suite-1.4.4.zip",
    "/downloads/print-agent/%2e%2e%2flatest.json",
  ]) {
    const response = await fetch(path);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.doesNotMatch(await response.text(), /<html/i);
  }
});
