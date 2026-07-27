import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";

const OFFICIAL_ORIGIN = "https://portal.hoteisfioreze.com.br";

test("migration aposenta dados do criador sem remover tabelas historicas", () => {
  const migration = fs.readFileSync("migrations/0026_retire_visual_portal_builder.sql", "utf8");

  assert.match(migration, /DELETE FROM visual_portal_templates;/);
  assert.match(migration, /DELETE FROM visual_portals;/);
  assert.doesNotMatch(migration, /\bDROP\b/i);
  assert.doesNotMatch(migration, /\b(?:orders|order_items|media_assets|events|hotel_information)\b/i);
});

test("criador livre sai do bundle e editor guiado vira a superficie oficial", () => {
  const retiredFiles = [
    "public/js/modules/admin/portal-builder.js",
    "public/js/modules/admin/portal-builder-state.js",
    "public/js/modules/visual-portal-runtime.js",
    "src/modules/admin/visual-portals.js",
    "src/modules/visual-portals/public.js",
    "src/services/visual-portal-document.js",
  ];
  for (const file of retiredFiles) assert.equal(fs.existsSync(file), false, file);

  for (const file of [
    "public/js/modules/admin/guest-portal-editor.js",
    "public/css/modules/admin/guest-portal-editor.css",
    "src/modules/guest-portal/shared.js",
  ]) {
    assert.equal(fs.existsSync(file), true, file);
  }
});

test("editor oficial limita servicos e oferece identidade conteudo midia e preview", () => {
  const editor = fs.readFileSync("public/js/modules/admin/guest-portal-editor.js", "utf8");
  const shell = fs.readFileSync("public/admin/portais/index.html", "utf8");

  assert.match(editor, /const SERVICE_KEYS = \["room-service", "emporio", "romantic-packages", "spa"\]/);
  assert.match(editor, /branding\.horizontal_logo_url/);
  assert.match(editor, /branding\.cover_image_url/);
  assert.match(editor, /portal\.module\.\$\{moduleKey\}\.description/);
  assert.match(editor, /data-guest-media-upload/);
  assert.match(editor, /fioreze:guest-portal-preview/);
  assert.match(shell, /id="guestPortalEditor"/);
  assert.match(shell, /Identidade/);
  assert.match(shell, /Serviços/);
  assert.doesNotMatch(shell, /Novo portal/);
});

test("template oficial atende hotel e modulos e rejeita slugs do criador aposentado", async () => {
  const requestedAssets = [];
  const { fetch } = createWorkerTestContext({
    GUEST_PORTAL_PUBLIC_ORIGIN: OFFICIAL_ORIGIN,
    ASSETS: {
      fetch(request) {
        requestedAssets.push(new URL(request.url).pathname);
        return new Response("<!doctype html><title>Portal do Hospede</title>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    },
  });

  const home = await fetch(`${OFFICIAL_ORIGIN}/muller-fioreze`, { redirect: "manual" });
  const roomService = await fetch(`${OFFICIAL_ORIGIN}/muller-fioreze/room-service`, { redirect: "manual" });
  const oldPortal = await fetch(`${OFFICIAL_ORIGIN}/muller-fioreze/experiencias`, { redirect: "manual" });
  const oldRoot = await fetch(`${OFFICIAL_ORIGIN}/portal/portal-antigo`, { redirect: "manual" });
  const oldContent = await fetch(`${OFFICIAL_ORIGIN}/portal-content/muller-fioreze/inicio`, { redirect: "manual" });

  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-type") || "", /text\/html/);
  assert.equal(roomService.status, 200);
  assert.deepEqual(requestedAssets, ["/", "/"]);
  for (const response of [oldPortal, oldRoot, oldContent]) {
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type") || "", /application\/json/);
    assert.doesNotMatch(await response.text(), /<!doctype html>/i);
  }
});

test("rotas administrativas e configuracao nao reexpoem o criador livre", () => {
  const routes = fs.readFileSync("src/modules/admin/routes.js", "utf8");
  const config = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));

  assert.doesNotMatch(routes, /visual-portals|visual-portal-templates/);
  assert.equal(config.vars.GUEST_PORTAL_PUBLIC_ORIGIN, OFFICIAL_ORIGIN);
  assert.equal(config.vars.VISUAL_PORTAL_PUBLIC_ORIGIN, undefined);
});

test("preview ao vivo aceita somente mensagens da origem administrativa", () => {
  const portal = fs.readFileSync("public/js/core/portal-home.js", "utf8");

  assert.match(portal, /event\.origin !== window\.location\.origin/);
  assert.match(portal, /event\.source !== window\.parent/);
  assert.match(portal, /fioreze:guest-portal-preview/);
});
