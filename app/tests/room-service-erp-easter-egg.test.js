import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(process.cwd(), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const modulePath = path.join(
  repoRoot,
  "app/public/js/modules/room-service-erp/easter-egg.js",
);
const { createSecretClickTracker } = await import(pathToFileURL(modulePath));

test("ERP easter egg requires seven rapid clicks and resets slow sequences", () => {
  const rapidClicks = createSecretClickTracker();
  for (let click = 1; click < 7; click += 1) {
    assert.equal(rapidClicks(click * 300), false);
  }
  assert.equal(rapidClicks(2100), true);
  assert.equal(rapidClicks(2400), false, "a completed sequence starts over");

  const slowClicks = createSecretClickTracker();
  for (let click = 0; click < 6; click += 1) {
    assert.equal(slowClicks(click * 500), false);
  }
  assert.equal(slowClicks(8000), false, "a late seventh click must restart the sequence");
});

test("ERP easter egg remains hidden inside the application version card", () => {
  const legacyApp = read("app/public/js/modules/room-service-erp/legacy-app.js");
  const entrypoint = read("app/public/js/modules/room-service-erp/app.js");
  const index = read("app/public/erp/room-service/index.html");

  assert.match(legacyApp, /title === "Fioreze ERP"/);
  assert.match(legacyApp, /data-wesley-easter-trigger/);
  assert.match(entrypoint, /setupErpEasterEgg\(\)/);
  assert.match(index, /easter-egg\.css/);
  assert.doesNotMatch(index, /easter egg|wesley lacerd/i);
});

test("ERP easter egg is an accessible on-demand modal shared by web and Electron", () => {
  const moduleSource = read("app/public/js/modules/room-service-erp/easter-egg.js");
  const styles = read("app/public/css/modules/room-service-erp/easter-egg.css");

  assert.match(moduleSource, /insertAdjacentHTML\("beforeend", easterEggMarkup\(\)\)/);
  assert.match(moduleSource, /role="dialog" aria-modal="true"/);
  assert.match(moduleSource, /event\.key === "Escape"/);
  assert.match(moduleSource, /event\.target === root\.querySelector\("#wesleyEasterOverlay"\)/);
  assert.match(moduleSource, /data-lucide="x"/);
  assert.match(moduleSource, /previousFocus\.focus\(\)/);
  assert.doesNotMatch(moduleSource, /openWesleyEasterEgg|globalThis\.[A-Za-z]*Easter/i);
  assert.doesNotMatch(moduleSource, /https?:\/\//);

  assert.match(styles, /backdrop-filter:\s*blur\(/);
  assert.match(styles, /font-family:\s*var\(--font-ui\)/);
  assert.match(styles, /max-height:\s*calc\(100vh - 40px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /\.wesley-close-button[\s\S]*background:\s*transparent\s*!important/);
});
