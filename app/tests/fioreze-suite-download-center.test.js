import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";

const MANIFEST = JSON.stringify({
  schema_version: 1,
  version: "1.5.0",
  file: "Fioreze-Suite-1.5.0.exe",
  sha256: "a".repeat(64),
  size_bytes: 3,
});

test("legacy human download shortcuts are retired", async () => {
  const { env, fetch } = createWorkerTestContext();
  await env.MEDIA_BUCKET.put("desktop/erp/releases/latest.yml", "version: 1.2.2\npath: Fioreze-ERP-Setup-1.2.2.exe\n");
  await env.MEDIA_BUCKET.put("desktop/erp/releases/Fioreze-ERP-Setup-1.2.2.exe", new Uint8Array([0x4d, 0x5a, 0x01]));
  await env.MEDIA_BUCKET.put("desktop/print-agent/releases/latest.json", MANIFEST);
  await env.MEDIA_BUCKET.put("desktop/print-agent/releases/Fioreze-Suite-1.5.0.exe", new Uint8Array([0x4d, 0x5a, 0x02]));

  for (const path of [
    "/downloads/erp/download",
    "/downloads/erp/installer",
    "/downloads/print-agent/download",
    "/downloads/print-agent/installer",
  ]) {
    const response = await fetch(path);
    assert.equal(response.status, 404, path);
    assert.match(response.headers.get("content-type"), /text\/html/);
  }
});

test("retiring human shortcuts does not affect OTA manifests or versioned artifacts", async () => {
  const { env, fetch } = createWorkerTestContext();
  await env.MEDIA_BUCKET.put("desktop/erp/releases/latest.yml", "version: 1.2.2\npath: Fioreze-ERP-Setup-1.2.2.exe\n");
  await env.MEDIA_BUCKET.put("desktop/erp/releases/Fioreze-ERP-Setup-1.2.2.exe", new Uint8Array([0x4d, 0x5a, 0x01]));
  await env.MEDIA_BUCKET.put("desktop/print-agent/releases/latest.json", MANIFEST);
  await env.MEDIA_BUCKET.put("desktop/print-agent/releases/Fioreze-Suite-1.5.0.exe", new Uint8Array([0x4d, 0x5a, 0x02]));

  const erpManifest = await fetch("/downloads/erp/latest.yml");
  const erpInstaller = await fetch("/downloads/erp/Fioreze-ERP-Setup-1.2.2.exe");
  const suiteManifest = await fetch("/downloads/print-agent/latest.json");
  const suiteInstaller = await fetch("/downloads/print-agent/Fioreze-Suite-1.5.0.exe");

  assert.equal(erpManifest.status, 200);
  assert.equal(erpInstaller.status, 200);
  assert.equal(suiteManifest.status, 200);
  assert.equal(suiteInstaller.status, 200);
  assert.equal(erpManifest.headers.get("cache-control"), "no-store");
  assert.equal(suiteManifest.headers.get("cache-control"), "no-store");
});
