"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  WINDOWS_11_MICA_MIN_BUILD,
  activateWindowMaterial,
  buildWindowSurfaceOptions,
  isRemoteWindowsSession,
  parseWindowsBuild,
  publicWindowAppearance,
  resolveWindowAppearance,
} = require("../window-material.cjs");

test("Windows 11 22H2 or newer selects native Mica when the API is available", () => {
  const appearance = resolveWindowAppearance({
    platform: "win32",
    release: `10.0.${WINDOWS_11_MICA_MIN_BUILD}`,
    micaApiAvailable: true,
  });

  assert.equal(appearance.material, "mica");
  assert.equal(appearance.nativeWindowControls, true);
  assert.deepEqual(buildWindowSurfaceOptions(appearance), {
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#00000000", symbolColor: "#475569", height: 44 },
    backgroundColor: "#00000000",
  });
});

test("Windows 10 and older Windows 11 builds use the stable Fluent fallback", () => {
  for (const release of ["10.0.19045", "10.0.22000"]) {
    const appearance = resolveWindowAppearance({ platform: "win32", release, micaApiAvailable: true });
    assert.equal(appearance.material, "fluent");
    assert.equal(buildWindowSurfaceOptions(appearance).titleBarOverlay.color, "#f3f3f3");
  }
});

test("Mica is not selected when its API is unavailable or the session is remote", () => {
  const unavailable = resolveWindowAppearance({ platform: "win32", release: "10.0.26200", micaApiAvailable: false });
  const remote = resolveWindowAppearance({ platform: "win32", release: "10.0.26200", micaApiAvailable: true, remoteSession: true });

  assert.equal(unavailable.material, "fluent");
  assert.equal(remote.material, "fluent");
  assert.equal(isRemoteWindowsSession({ SESSIONNAME: "RDP-Tcp#12" }), true);
  assert.equal(isRemoteWindowsSession({ SESSIONNAME: "Console" }), false);
});

test("high contrast and non-Windows environments receive solid readable surfaces", () => {
  const highContrast = resolveWindowAppearance({ platform: "win32", release: "10.0.26200", highContrast: true, micaApiAvailable: true });
  const otherPlatform = resolveWindowAppearance({ platform: "linux", release: "6.8.0", micaApiAvailable: true });

  assert.equal(highContrast.material, "solid");
  assert.equal(buildWindowSurfaceOptions(highContrast).titleBarOverlay.color, "#ffffff");
  assert.equal(otherPlatform.material, "solid");
  assert.deepEqual(buildWindowSurfaceOptions(otherPlatform), { frame: false, backgroundColor: "#ffffff" });
});

test("a native Mica activation failure falls back without retrying or throwing", () => {
  const calls = [];
  const appearance = resolveWindowAppearance({ platform: "win32", release: "10.0.26200", micaApiAvailable: true });
  const window = {
    setBackgroundMaterial(material) {
      calls.push(["material", material]);
      throw new Error("unsupported");
    },
    setBackgroundColor(color) {
      calls.push(["background", color]);
    },
    setTitleBarOverlay(options) {
      calls.push(["overlay", options.color]);
    },
  };

  const fallback = activateWindowMaterial(window, appearance);
  assert.equal(fallback.material, "fluent");
  assert.deepEqual(calls, [["material", "mica"], ["background", "#f3f3f3"], ["overlay", "#f3f3f3"]]);
});

test("only the semantic material state is exposed to the renderer", () => {
  assert.equal(parseWindowsBuild("10.0.26200.0"), 26200);
  assert.equal(parseWindowsBuild("invalid"), 0);
  assert.deepEqual(publicWindowAppearance({ material: "mica", nativeWindowControls: true, windowsBuild: 26200, reason: "test" }), {
    material: "mica",
    nativeWindowControls: true,
  });
});
