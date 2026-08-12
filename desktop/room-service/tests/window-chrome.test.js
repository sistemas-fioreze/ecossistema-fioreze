"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  WINDOW_CHROME_BACKGROUND,
  buildWindowChromeOptions,
  publicWindowChrome,
} = require("../window-chrome.cjs");

test("Windows uses a stable solid title bar with native controls", () => {
  assert.deepEqual(buildWindowChromeOptions("win32"), {
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: WINDOW_CHROME_BACKGROUND,
      symbolColor: "#475569",
      height: 44,
    },
    backgroundColor: WINDOW_CHROME_BACKGROUND,
  });
  assert.deepEqual(publicWindowChrome("win32"), {
    material: "solid",
    nativeWindowControls: true,
  });
});

test("other platforms keep the same solid surface with custom controls", () => {
  assert.deepEqual(buildWindowChromeOptions("linux"), {
    frame: false,
    backgroundColor: WINDOW_CHROME_BACKGROUND,
  });
  assert.deepEqual(publicWindowChrome("linux"), {
    material: "solid",
    nativeWindowControls: false,
  });
});

test("window chrome never requests translucent operating-system materials", () => {
  const source = require("node:fs").readFileSync(require.resolve("../window-chrome.cjs"), "utf8");
  assert.doesNotMatch(source, /mica|fluent|setBackgroundMaterial|transparent/i);
});
