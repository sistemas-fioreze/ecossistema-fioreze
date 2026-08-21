import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const ERP_HTML = "public/erp/room-service/index.html";
const ERP_MODULES = "public/js/modules/room-service-erp";
const ICON_BUNDLE = "public/js/vendor/lucide-erp.min.js";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function erpSourceFiles() {
  return [
    ERP_HTML,
    ...fs.readdirSync(ERP_MODULES)
      .filter((name) => name.endsWith(".js"))
      .map((name) => path.join(ERP_MODULES, name)),
  ];
}

test("ERP uses a local, pinned Lucide bundle as its only icon library", () => {
  const packageJson = JSON.parse(read("package.json"));
  const html = read(ERP_HTML);
  const bundle = read(ICON_BUNDLE);

  assert.equal(packageJson.dependencies.lucide, "1.27.0");
  assert.match(html, /<script src="\/js\/vendor\/lucide-erp\.min\.js\?v=1\.27\.0"><\/script>/);
  assert.ok(html.indexOf("lucide-erp.min.js") < html.indexOf("room-service-erp/app.js"));
  assert.doesNotMatch(html, /unpkg|jsdelivr|cdnjs|font-?awesome/i);
  assert.ok(bundle.length > 10_000);
  assert.ok(bundle.length < 50_000);
});

test("ERP source outside the preserved retro easter egg contains only Lucide controls", () => {
  const sources = erpSourceFiles()
    .filter((file) => !file.endsWith("easter-egg.js"))
    .map((file) => `${file}\n${read(file)}`)
    .join("\n");

  assert.doesNotMatch(sources, /<svg\b/i);
  assert.doesNotMatch(sources, /font-?awesome|\bfa-[a-z]/i);
  assert.doesNotMatch(sources, /\p{Extended_Pictographic}/u);
  assert.doesNotMatch(sources, />\s*(?:x|\u00d7|\?|\u2713|\u2715|\u2716)\s*<\/button>/i);
});

test("every literal ERP icon is available in the generated Lucide bundle", () => {
  const context = {};
  context.globalThis = context;
  vm.runInNewContext(read(ICON_BUNDLE), context);

  const names = new Set();
  for (const file of erpSourceFiles()) {
    const source = read(file);
    for (const match of source.matchAll(/data-lucide="([^"]+)"|iconMarkup\("([^"]+)"/g)) {
      const name = match[1] || match[2];
      if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) names.add(name);
    }
  }

  assert.ok(names.size >= 40);
  for (const name of names) {
    const componentName = name.split("-").map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join("");
    assert.ok(context.FiorezeLucide.icons[componentName], `${name} is missing from the Lucide bundle`);
  }
});

test("Lucide runtime keeps dynamic ERP content rendered with one stroke system", async () => {
  const source = read(`${ERP_MODULES}/icon-system.js`);
  const { iconMarkup } = await import(`../public/js/modules/room-service-erp/icon-system.js?test=${Date.now()}`);

  assert.equal(iconMarkup("shopping-cart", "w-5 h-5"), '<i data-lucide="shopping-cart" class="w-5 h-5" aria-hidden="true"></i>');
  assert.match(source, /"stroke-width": "1\.9"/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /i\[data-lucide\]/);
});

test("ERP sidebar reserves a 24px optical slot around 20px Lucide icons", () => {
  const html = read(ERP_HTML);
  const shell = read(`${ERP_MODULES}/shell.js`);
  const css = read("public/css/modules/room-service-erp/design-system-v5.css");

  assert.match(html, /class="erp-nav-icon"/);
  assert.match(shell, /class="erp-nav-icon"/);
  assert.match(css, /\.erp-nav-icon \{[\s\S]*flex: 0 0 24px;[\s\S]*height: 24px;[\s\S]*width: 24px;/);
  assert.match(css, /\.erp-nav-icon > \.lucide \{[\s\S]*height: 20px !important;[\s\S]*stroke-width: 1\.9;[\s\S]*width: 20px !important;/);
});
