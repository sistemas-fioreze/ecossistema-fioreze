import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appEntry = fs.readFileSync(new URL("../public/js/modules/room-service-erp/app.js", import.meta.url), "utf8");
const loadingModule = fs.readFileSync(new URL("../public/js/modules/room-service-erp/desktop-loading-experience.js", import.meta.url), "utf8");
const loadingCss = fs.readFileSync(new URL("../public/css/modules/room-service-erp/desktop-loading-experience.css", import.meta.url), "utf8");

test("Electron ERP installs a dedicated full-screen loading experience", () => {
  assert.match(appEntry, /setupDesktopLoadingExperience/);
  assert.match(loadingModule, /fiorezeDesktop\?\.isElectron/);
  assert.match(loadingModule, /getElementById\("loginLoadingScreen"\)/);
  assert.match(loadingModule, /desktop-loading-experience/);
  assert.match(loadingModule, /Preparando seu ambiente/);
  assert.match(loadingCss, /\.login-card\.is-loading[\s\S]*position:\s*fixed/);
  assert.match(loadingCss, /\.desktop-loading-screen[\s\S]*background:\s*#f7f8fa/);
});

test("Electron loading keeps the live login status without fake percentage progress", () => {
  assert.match(loadingModule, /id="loginLoadingText"/);
  assert.match(loadingModule, /MutationObserver\(syncMessage\)/);
  assert.match(loadingModule, /Validando sua sessão/);
  assert.match(loadingModule, /Validando seu acesso/);
  assert.match(loadingCss, /\.desktop-loading-progress span[\s\S]*animation:\s*desktopLoadingProgress/);
  assert.doesNotMatch(loadingModule, /\b\d{1,3}%\b/);
});

test("Electron loading exposes slow-connection and retry states", () => {
  assert.match(loadingModule, /SLOW_NOTICE_DELAY = 7000/);
  assert.match(loadingModule, /RETRY_DELAY = 12000/);
  assert.match(loadingModule, /Isso está levando um pouco mais de tempo/);
  assert.match(loadingModule, /Tentar novamente/);
  assert.match(loadingModule, /fiorezeDesktop\?\.reload/);
});

test("Electron loading obeys ERP typography and stylesheet guardrails", () => {
  assert.doesNotMatch(loadingCss, /@import\s+url\(/i);
  assert.doesNotMatch(loadingCss, /font-weight:\s*(?:450|520|550|620|650|680|7\d{2}|8\d{2}|9\d{2})(?:\s|;|!)/);
  assert.doesNotMatch(loadingCss, /font-size:\s*(?:7|7\.5|8|8\.5|9|9\.5|10|10\.5|11|11\.5)px/);
});
