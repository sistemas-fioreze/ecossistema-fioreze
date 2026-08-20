import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd(), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("ERP Room Service exposes desktop controls only through the adapter", () => {
  const html = read("app/public/erp/room-service/index.html");
  const app = read("app/public/js/modules/room-service-erp/app.js");
  const adapter = read("app/public/js/modules/room-service-erp/desktop-adapter.js");
  const css = [
    read("app/public/css/modules/room-service-erp/shell.css"),
    read("app/public/css/modules/room-service-erp/design-system-v5.css"),
  ].join("\n");

  assert.match(html, /rs-window-controls/);
  assert.match(html, /desktopMinimize/);
  assert.match(app, /setupDesktopControls\(\)/);
  assert.match(adapter, /window\.fiorezeDesktop/);
  assert.match(adapter, /dataset\.fiorezeDesktop = "browser"/);
  assert.match(adapter, /dataset\.fiorezeDesktop = "electron"/);
  assert.match(adapter, /--erp-desktop-bottom-inset/);
  assert.match(adapter, /workAreaBottomInset/);
  assert.match(adapter, /dataset\.windowMaterial = "solid"/);
  assert.match(adapter, /dataset\.windowControls = controlMode/);
  assert.match(adapter, /getWindowAppearance/);
  assert.match(adapter, /checkForUpdates/);
  assert.match(css, /body\[data-fioreze-desktop="electron"\] \.rs-window-controls/);
  assert.match(css, /--erp-desktop-titlebar-height:\s*44px/);
  assert.match(css, /padding-top:\s*var\(--erp-desktop-titlebar-height/);
  assert.match(css, /height:\s*calc\(100dvh - var\(--erp-desktop-titlebar-height/);
  assert.match(css, /#loginOverlay[^}]*top:\s*var\(--erp-desktop-titlebar-height/s);
  assert.match(css, /#printManagerModal\.desktop-print-status-modal:not\(\.hidden\)\s*\{[\s\S]*?display:\s*flex\s*!important/);
  assert.match(html, /rs-desktop-titlebar/);
  assert.match(html, /desktopPrintManager/);
  assert.match(html, /id="desktopWorkspace" class="rs-desktop-workspace"/);
  assert.match(html, /id="desktopPrintManager" class="rs-desktop-tool rs-desktop-print-tool"/);
  const printButton = html.match(/<button id="desktopPrintManager"[\s\S]*?<\/button>/)?.[0] || "";
  assert.ok(printButton);
  assert.doesNotMatch(printButton, /<span>/);
  assert.match(html, /desktopReload/);
  assert.doesNotMatch(html, /rs-desktop-app-mark/);
  assert.match(css, /-webkit-app-region:\s*drag/);
  assert.match(css, /:is\(\.rs-desktop-titlebar, \.app-sidebar\) \{[\s\S]*background:\s*#f7f8fa/);
  assert.match(css, /\.app-main \{[\s\S]*border-top:\s*1px solid var\(--erp-line\)[\s\S]*border-left:\s*1px solid var\(--erp-line\)[\s\S]*border-top-left-radius:\s*14px/);
  assert.match(css, /\.rs-desktop-titlebar::after \{\s*content:\s*none;/);
  assert.doesNotMatch(css, /data-window-material="mica"|data-window-material="fluent"/);
  assert.match(css, /data-window-controls="native"/);
  assert.doesNotMatch(html, /require\("electron"\)|require\('electron'\)/);
});

test("Electron wrapper is thin, hardened, and does not duplicate backend access", () => {
  const main = read("desktop/room-service/main.cjs");
  const preload = read("desktop/room-service/preload.cjs");
  const windowChrome = read("desktop/room-service/window-chrome.cjs");
  const html = read("app/public/erp/room-service/index.html");
  const adapter = read("app/public/js/modules/room-service-erp/desktop-adapter.js");
  const packageJson = JSON.parse(read("desktop/room-service/package.json"));

  assert.equal(packageJson.main, "main.cjs");
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(windowChrome, /titleBarStyle:\s*"hidden"/);
  assert.match(windowChrome, /titleBarOverlay/);
  assert.match(windowChrome, /WINDOW_CHROME_BACKGROUND\s*=\s*"#f7f8fa"/);
  assert.match(windowChrome, /WINDOW_CHROME_OVERLAY\s*=\s*"#f7f8fa00"/);
  assert.doesNotMatch(windowChrome, /setBackgroundMaterial|mica|fluent/i);
  assert.match(main, /\/erp\/room-service\//);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(main, /will-navigate/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\(\s*"fiorezeDesktop"/);
  assert.match(preload, /getWindowAppearance/);
  assert.match(preload, /getPrintAgentStatus/);
  assert.match(preload, /restartPrintAgent/);
  assert.doesNotMatch(preload, /openPrintManager/);
  assert.match(html, /desktopPrintStatusTitle/);
  assert.match(html, /Reiniciar servidor/);
  assert.doesNotMatch(html, /printCfgHotel|Imprimir teste|Reimprimir ultimo/);
  assert.match(adapter, /isPrintServerComputer/);
  assert.match(adapter, /installDesktopWorkspace\(root\)/);
  assert.match(adapter, /if \(search\) workspace\.append\(search\)/);
  assert.match(adapter, /if \(feedback\) workspace\.append\(feedback\)/);
  assert.doesNotMatch(adapter, /label\.textContent = status\?\.running \? "Impressao online"/);
  assert.match(adapter, /Nenhum servidor de impressão será iniciado neste computador/);
  assert.doesNotMatch(adapter, /openPrintManager/);
  assert.ok(packageJson.build.files.includes("window-chrome.cjs"));

  const combined = `${main}\n${preload}`;
  assert.doesNotMatch(combined, /script\.google\.com|spreadsheets|private_key|client_email/i);
  assert.doesNotMatch(combined, /D1|R2|MEDIA_BUCKET|DB\b/);
});

test("ERP printing settings can copy an enrollment code and control the local agent", () => {
  const app = read("app/public/js/modules/room-service-erp/legacy-app.js");
  assert.match(app, /id="copyPrinterEnrollmentCode"/);
  assert.match(app, /navigator\.clipboard\.writeText/);
  assert.match(app, /refreshLocalPrintAgentStatus/);
  assert.match(app, /restartLocalPrintAgent/);
  assert.match(app, /Reiniciar servidor/);
});

test("order details use the horizontal Electron workspace and live printing state", () => {
  const app = read("app/public/js/modules/room-service-erp/legacy-app.js");
  const api = read("app/public/js/modules/room-service-erp/api.js");
  const css = read("app/public/css/modules/room-service-erp/design-system-v5.css");

  assert.match(app, /installOrderDetailsInterface/);
  assert.match(app, /order-detail-layout/);
  assert.match(app, /order-detail-facts/);
  assert.match(app, /orderDisplayLabel/);
  assert.match(app, /Pedido #\$\{displayNumber\}/);
  assert.match(app, /renderOrderPrinting/);
  assert.match(app, /detPrintAgentStatus/);
  assert.match(app, /Marcar como entregue/);
  assert.match(app, /data-order-reprint/);
  assert.match(app, /orderStatusDialog/);
  assert.doesNotMatch(app, /id="detPublicId"/);
  assert.doesNotMatch(app, /Impressao indisponivel/);
  assert.doesNotMatch(app, /window\.prompt\("Informe o motivo do cancelamento/);
  assert.match(api, /orders\/\$\{encodeURIComponent\(orderId\)\}\/print/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1\.32fr\) minmax\(340px, \.82fr\)/);
  assert.match(css, /\.order-detail-layout \{[\s\S]*overflow-y:\s*auto/);
  assert.match(css, /\.order-detail-primary,[\s\S]*\.order-detail-secondary \{[\s\S]*overflow:\s*visible/);
  assert.match(css, /\.order-action-danger \{[\s\S]*background:\s*#fff8f8/);
  assert.match(css, /body\[data-fioreze-desktop="electron"\].*#orderDetailCard\.order-detail-dialog/s);
  assert.match(css, /body\[data-fioreze-desktop="electron"\]\[data-erp="room-service"\] #orderDetailCard\.order-detail-dialog \{[\s\S]*width:\s*min\(1120px, calc\(100% - 64px\)\)/);
  assert.match(css, /height:\s*min\(610px, calc\(100% - 56px\)\)/);
  assert.match(css, /body\[data-fioreze-desktop="electron"\]\[data-erp="room-service"\] #orderModal \{[\s\S]*padding:\s*28px 32px/);
});

test("settings stays available outside the ERP sidebar", () => {
  const config = read("app/public/js/modules/room-service-erp/static-config.js");
  const shell = read("app/public/js/modules/room-service-erp/shell.js");
  const legacyApp = read("app/public/js/modules/room-service-erp/legacy-app.js");
  const entrypoint = read("app/public/js/modules/room-service-erp/app.js");
  const html = read("app/public/erp/room-service/index.html");
  const css = read("app/public/css/modules/room-service-erp/design-system-v5.css");

  assert.match(config, /key:\s*"settings"[\s\S]*sidebar:\s*false/);
  assert.match(shell, /NAV_ITEMS\.filter\(\(item\) => item\.sidebar !== false\)/);
  assert.match(css, /#btnTabAdmin \{[\s\S]*display:\s*none !important/);
  assert.match(legacyApp, /setNavigationVisibility\("btnTabAdmin", false\)/);
  assert.doesNotMatch(legacyApp, /\["btnTabAdmin", "Sistema"\]/);
  assert.match(legacyApp, /switchTab\("admin", \{ allowHidden: true \}\)/);
  assert.match(legacyApp, /function switchTab\(route, \{ allowHidden = false \} = \{\}\)/);
  assert.match(entrypoint, /desktop-adapter\.js\?v=20260814-6/);
  assert.match(entrypoint, /icon-system\.js\?v=20260814-6/);
  assert.match(entrypoint, /legacy-app\.js\?v=20260820-5/);
  assert.match(html, /design-system-v5\.css\?v=20260820-2/);
  assert.match(html, /lucide-erp\.min\.js\?v=1\.27\.0/);
  assert.match(html, /app\.js\?v=20260820-6/);
});

test("collapsed ERP navigation keeps the active item on a centered square tile", () => {
  const css = read("app/public/css/modules/room-service-erp/design-system-v5.css");

  assert.match(css, /sidebar-collapsed #navBar \{[\s\S]*?align-items:\s*center/);
  assert.match(css, /sidebar-collapsed \.side-nav-btn \{[\s\S]*?width:\s*44px !important;[\s\S]*?height:\s*44px !important;[\s\S]*?border-radius:\s*12px !important/);
});
