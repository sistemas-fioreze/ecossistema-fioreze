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
  assert.match(moduleSource, /id="wesleyCloseButton"[\s\S]*>×<\/button>/);
  assert.match(moduleSource, /id="wesleyOkButton"/);
  assert.match(moduleSource, /previousFocus\.focus\(\)/);
  assert.doesNotMatch(moduleSource, /openWesleyEasterEgg|globalThis\.[A-Za-z]*Easter/i);
  assert.doesNotMatch(moduleSource, /https?:\/\//);

  assert.match(styles, /backdrop-filter:\s*blur\(/);
  assert.match(styles, /z-index:\s*999999/);
  assert.match(styles, /rs-electron-shell:has\(\.wesley-easter-overlay\.active\)[\s\S]*\.rs-desktop-titlebar/);
  assert.match(styles, /font-family:\s*Tahoma,\s*"MS Sans Serif",\s*Arial,\s*sans-serif/);
  assert.match(styles, /\.wesley-easter-overlay\.active \.wesley-retro-window\.opening/);
  assert.match(styles, /animation:\s*wesleyWindowOpen\s*\.22s\s*steps\(4, end\)\s*forwards\s*!important/);
  assert.match(styles, /\.wesley-close-button[\s\S]*background:\s*#c0c0c0\s*!important/);
});

test("ERP easter egg preserves the original retro artwork and copy", () => {
  const moduleSource = read("app/public/js/modules/room-service-erp/easter-egg.js");
  const styles = read("app/public/css/modules/room-service-erp/easter-egg.css");

  assert.match(moduleSource, />★<\/span>/);
  assert.match(moduleSource, />✦<\/span>/);
  assert.match(moduleSource, />✧<\/span>/);
  assert.match(moduleSource, /<span>ERP<\/span>/);
  assert.match(moduleSource, /por incrível q pareça, tá funcionando/);
  assert.match(moduleSource, /GEPE FAZ UM PROMPT PRA MIM/);
  assert.match(moduleSource, /v∞-em-desenvolvimento/);
  assert.match(moduleSource, /<div class="wesley-wordart-subtitle">certified computer person<\/div>/);
  assert.match(moduleSource, /<div class="wesley-marquee">★ ESTE ERP SOBREVIVEU/);
  assert.doesNotMatch(moduleSource, /data-lucide/);
  assert.match(styles, /font-family:\s*Impact,\s*"Arial Black",\s*sans-serif/);
  assert.match(styles, /font-family:\s*"Comic Sans MS",\s*cursive/);
  assert.match(styles, /font-family:\s*"Courier New",\s*monospace/);
  assert.match(styles, /letter-spacing:\s*2px/);
  assert.match(styles, /\.wesley-easter-overlay\.active \.wesley-wordart[\s\S]*animation:\s*wesleyWordartEntrance\s*\.6s\s*steps\(6, end\)\s*!important/);
  assert.match(styles, /\.wesley-easter-overlay\.active \.wesley-star[\s\S]*animation:\s*wesleyStarBlink\s*1\.2s\s*steps\(2, end\)\s*infinite\s*!important/);
  assert.match(styles, /\.wesley-easter-overlay\.active \.wesley-marquee[\s\S]*animation:\s*wesleyMarquee\s*13s\s*linear\s*infinite\s*!important/);
  assert.match(styles, /\.wesley-retro-button:focus-visible[\s\S]*outline:\s*1px dotted #000 !important/);
  assert.match(styles, /\.wesley-retro-button:active[\s\S]*transform:\s*none !important/);
});
