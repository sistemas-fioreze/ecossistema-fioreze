"use strict";

const WINDOWS_11_MICA_MIN_BUILD = 22621;
const WINDOW_TITLEBAR_HEIGHT = 44;

function parseWindowsBuild(release) {
  const parts = String(release || "").split(".");
  const build = Number.parseInt(parts[2] || "", 10);
  return Number.isFinite(build) ? build : 0;
}

function isRemoteWindowsSession(environment = process.env) {
  const sessionName = String(environment.SESSIONNAME || "").trim();
  return /^(RDP-|ICA-|REMOTE)/i.test(sessionName);
}

function resolveWindowAppearance({
  platform,
  release,
  highContrast = false,
  remoteSession = false,
  micaApiAvailable = false,
}) {
  const windowsBuild = platform === "win32" ? parseWindowsBuild(release) : 0;

  if (platform !== "win32") {
    return Object.freeze({
      material: "solid",
      nativeWindowControls: false,
      windowsBuild,
      reason: "non-windows",
    });
  }

  if (highContrast) {
    return Object.freeze({
      material: "solid",
      nativeWindowControls: true,
      windowsBuild,
      reason: "high-contrast",
    });
  }

  if (windowsBuild >= WINDOWS_11_MICA_MIN_BUILD && micaApiAvailable && !remoteSession) {
    return Object.freeze({
      material: "mica",
      nativeWindowControls: true,
      windowsBuild,
      reason: "windows-11-mica",
    });
  }

  return Object.freeze({
    material: "fluent",
    nativeWindowControls: true,
    windowsBuild,
    reason: remoteSession ? "remote-session" : windowsBuild < WINDOWS_11_MICA_MIN_BUILD ? "unsupported-windows-build" : "mica-api-unavailable",
  });
}

function buildWindowSurfaceOptions(appearance) {
  if (!appearance.nativeWindowControls) {
    return {
      frame: false,
      backgroundColor: "#ffffff",
    };
  }

  const titleBarOverlay = appearance.material === "solid"
    ? { color: "#ffffff", symbolColor: "#111827", height: WINDOW_TITLEBAR_HEIGHT }
    : {
        color: appearance.material === "mica" ? "#00000000" : "#f3f3f3",
        symbolColor: "#475569",
        height: WINDOW_TITLEBAR_HEIGHT,
      };

  return {
    titleBarStyle: "hidden",
    titleBarOverlay,
    backgroundColor: appearance.material === "mica" ? "#00000000" : appearance.material === "fluent" ? "#f3f3f3" : "#ffffff",
  };
}

function activateWindowMaterial(window, appearance) {
  if (appearance.material !== "mica") return appearance;

  try {
    window.setBackgroundMaterial("mica");
    return appearance;
  } catch {
    const fallback = Object.freeze({
      ...appearance,
      material: "fluent",
      reason: "mica-activation-failed",
    });
    window.setBackgroundColor("#f3f3f3");
    window.setTitleBarOverlay({ color: "#f3f3f3", symbolColor: "#475569", height: WINDOW_TITLEBAR_HEIGHT });
    return fallback;
  }
}

function publicWindowAppearance(appearance) {
  return Object.freeze({
    material: appearance.material,
    nativeWindowControls: appearance.nativeWindowControls,
  });
}

module.exports = {
  WINDOWS_11_MICA_MIN_BUILD,
  WINDOW_TITLEBAR_HEIGHT,
  activateWindowMaterial,
  buildWindowSurfaceOptions,
  isRemoteWindowsSession,
  parseWindowsBuild,
  publicWindowAppearance,
  resolveWindowAppearance,
};
