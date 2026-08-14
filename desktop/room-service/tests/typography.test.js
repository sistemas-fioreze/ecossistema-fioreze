const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const desktopRoot = path.resolve(__dirname, "..");

test("Electron packages local Inter Variable fonts and uses them in the offline state", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"));
  const html = fs.readFileSync(path.join(desktopRoot, "unconfigured.html"), "utf8");
  const regular = fs.readFileSync(path.join(desktopRoot, "fonts", "inter", "InterVariable.woff2"));
  const italic = fs.readFileSync(path.join(desktopRoot, "fonts", "inter", "InterVariable-Italic.woff2"));

  assert.ok(packageJson.build.files.includes("fonts/inter/**/*"));
  assert.equal(regular.subarray(0, 4).toString("ascii"), "wOF2");
  assert.equal(italic.subarray(0, 4).toString("ascii"), "wOF2");
  assert.match(html, /font-src 'self'/);
  assert.match(html, /\.\/fonts\/inter\/InterVariable\.woff2/);
  assert.match(html, /\.\/fonts\/inter\/InterVariable-Italic\.woff2/);
  assert.match(html, /--font-ui:\s*"Inter", Arial, sans-serif/);
  assert.doesNotMatch(html, /Segoe UI|system-ui|fonts\.googleapis|fonts\.gstatic/i);
});
