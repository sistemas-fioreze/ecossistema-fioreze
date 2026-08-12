"use strict";

const WINDOW_CHROME_BACKGROUND = "#f7f8fa";
const WINDOW_CHROME_SYMBOL = "#475569";
const WINDOW_TITLEBAR_HEIGHT = 44;

function buildWindowChromeOptions(platform = process.platform) {
  if (platform !== "win32") {
    return {
      frame: false,
      backgroundColor: WINDOW_CHROME_BACKGROUND,
    };
  }

  return {
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: WINDOW_CHROME_BACKGROUND,
      symbolColor: WINDOW_CHROME_SYMBOL,
      height: WINDOW_TITLEBAR_HEIGHT,
    },
    backgroundColor: WINDOW_CHROME_BACKGROUND,
  };
}

function publicWindowChrome(platform = process.platform) {
  return Object.freeze({
    material: "solid",
    nativeWindowControls: platform === "win32",
  });
}

module.exports = {
  WINDOW_CHROME_BACKGROUND,
  WINDOW_CHROME_SYMBOL,
  WINDOW_TITLEBAR_HEIGHT,
  buildWindowChromeOptions,
  publicWindowChrome,
};
