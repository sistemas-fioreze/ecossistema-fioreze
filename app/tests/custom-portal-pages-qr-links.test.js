import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { sanitizeCustomHtml } from "../src/services/custom-html-sanitizer.js";
import { ADMIN_ORIGIN, AURORA_USER_ID, createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

const HOTEL_PERMISSIONS = ["portals.hotels.read", "portals.hotels.settings"];
const LINK_PERMISSIONS = ["portals.links.read", "portals.links.archive", "portals.links.delete"];

test("migration 0020 cria paginas HTML por hotel e exclusao dedicada de links", () => {
  const migration = fs.readFileSync("migrations/0020_portal_custom_pages_qr_links.sql", "utf8").toLowerCase();
  assert.match(migration, /create table if not exists custom_portal_pages/);
  assert.match(migration, /unique \(hotel_id, slug\)/);
  assert.match(migration, /check \(length\(sanitized_html\) between 1 and 250000\)/);
  assert.match(migration, /portals\.links\.delete/);
  assert.match(migration, /insert or ignore into admin_role_permissions/);
});

test("sanitizador usa lista positiva e remove codigo executavel", () => {
  const result = sanitizeCustomHtml(`
    <main onclick="alert(1)" style="color:#513b2d;position:fixed">
      <h1>Boas-vindas</h1>
      <a href="javascript:alert(1)">Inseguro</a>
      <img src="https://example.invalid/banner.png" onerror="alert(1)">
      <form action="https://example.invalid"><input name="token"></form>
      <iframe src="https://example.invalid"></iframe>
      <script>alert(1)</script>
    </main>
  `);

  assert.equal(result.changed, true);
  assert.match(result.html, /Boas-vindas/);
  assert.match(result.html, /https:\/\/example\.invalid\/banner\.png/);
  assert.doesNotMatch(result.html, /script|onclick|onerror|javascript:|<form|<iframe|<input|position:/i);
});

test("pagina HTML salva somente conteudo sanitizado e publica em iframe sandbox", async () => {
  const { json, fetch, env } = createWorkerTestContext();
  grantPermissions(env, HOTEL_PERMISSIONS);
  const cookie = await createSessionCookie(env);
  const created = await json(
    "/api/v1/admin/custom-portal-pages",
    withCookie(cookie, adminJson("POST", {
      hotel_id: "muller-fioreze",
      slug: "boas-vindas",
      title: "Boas-vindas",
      status: "published",
      html: '<main onclick="alert(1)"><h1>Olá</h1><script>segredo()</script><a href="https://example.invalid">Conheça</a></main>',
    })),
  );

  assert.equal(created.response.status, 201);
  assert.equal(created.body.data.sanitization.changed, true);
  assert.equal(created.body.data.page.public_url, `${ADMIN_ORIGIN}/portal-content/muller-fioreze/boas-vindas`);
  assert.doesNotMatch(env.__data.customPortalPages[0].sanitized_html, /onclick|script|segredo/i);
  assert.equal(Object.hasOwn(env.__data.customPortalPages[0], "original_html"), false);

  const publicPage = await fetch("/portal-content/muller-fioreze/boas-vindas");
  const body = await publicPage.text();
  assert.equal(publicPage.status, 200);
  assert.match(publicPage.headers.get("content-type") || "", /text\/html/);
  assert.match(publicPage.headers.get("content-security-policy") || "", /script-src 'none'/);
  assert.match(body, /sandbox="allow-popups allow-popups-to-escape-sandbox"/);
  assert.match(body, /Ol[áa]|Ol&#225;/);
  assert.doesNotMatch(body, /onclick|segredo\(\)|<script/i);

  const head = await fetch("/portal-content/muller-fioreze/boas-vindas", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("paginas em rascunho, arquivadas ou de outro hotel nao vazam", async () => {
  const { json, fetch, env } = createWorkerTestContext();
  grantPermissions(env, HOTEL_PERMISSIONS);
  const cookie = await createSessionCookie(env);
  const created = await json(
    "/api/v1/admin/custom-portal-pages",
    withCookie(cookie, adminJson("POST", {
      hotel_id: "muller-fioreze",
      slug: "pagina-interna",
      title: "Página interna",
      status: "draft",
      html: "<h1>Conteúdo interno</h1>",
    })),
  );
  const pageId = created.body.data.page.id;

  assert.equal((await fetch("/portal-content/muller-fioreze/pagina-interna")).status, 404);
  assert.equal((await fetch("/portal-content/aurora-demo/pagina-interna")).status, 404);

  const auroraCookie = await createSessionCookie(env, AURORA_USER_ID);
  const forbidden = await json(`/api/v1/admin/custom-portal-pages/${pageId}`, withCookie(auroraCookie));
  assert.equal(forbidden.response.status, 404);

  const published = await json(
    `/api/v1/admin/custom-portal-pages/${pageId}`,
    withCookie(cookie, adminJson("PATCH", {
      slug: "pagina-interna",
      title: "Página interna",
      status: "published",
      html: "<h1>Conteúdo público</h1>",
    })),
  );
  assert.equal(published.response.status, 200);
  assert.equal((await fetch("/portal-content/muller-fioreze/pagina-interna")).status, 200);

  const archived = await json(
    `/api/v1/admin/custom-portal-pages/${pageId}`,
    withCookie(cookie, adminJson("DELETE", {})),
  );
  assert.equal(archived.body.data.page.status, "archived");
  assert.equal((await fetch("/portal-content/muller-fioreze/pagina-interna")).status, 404);
});

test("QR Code administrativo e SVG protegido sem resposta HTML", async () => {
  const { fetch, env } = createWorkerTestContext();
  grantPermissions(env, ["portals.links.read"]);
  const cookie = await createSessionCookie(env);

  const response = await fetch("/api/v1/admin/short-links/link-muller-reservas/qrcode.svg", withCookie(cookie));
  const svg = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /image\/svg\+xml/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(svg, /^<svg/);
  assert.doesNotMatch(svg, /<html/i);

  const download = await fetch(
    "/api/v1/admin/short-links/link-muller-reservas/qrcode.svg?download=1",
    withCookie(cookie),
  );
  assert.match(download.headers.get("content-disposition") || "", /qr-reservas\.svg/);
});

test("exclusao permanente exige arquivamento, permissao e preserva auditoria", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env, LINK_PERMISSIONS);
  const cookie = await createSessionCookie(env);

  const blocked = await json(
    "/api/v1/admin/short-links/link-muller-reservas/permanent",
    withCookie(cookie, adminJson("DELETE", {})),
  );
  assert.equal(blocked.response.status, 409);
  assert.ok(env.__data.shortLinks.some((link) => link.id === "link-muller-reservas"));

  env.__data.shortLinkClicksDaily.push({
    short_link_id: "link-muller-reservas",
    hotel_id: "muller-fioreze",
    click_date: "2026-07-17",
    click_count: 2,
    first_clicked_at: "2026-07-17T10:00:00.000Z",
    last_clicked_at: "2026-07-17T11:00:00.000Z",
  });
  await json(
    "/api/v1/admin/short-links/link-muller-reservas",
    withCookie(cookie, adminJson("DELETE", {})),
  );
  const deleted = await json(
    "/api/v1/admin/short-links/link-muller-reservas/permanent",
    withCookie(cookie, adminJson("DELETE", {})),
  );

  assert.equal(deleted.response.status, 200);
  assert.equal(deleted.body.data.deleted, true);
  assert.equal(env.__data.shortLinks.some((link) => link.id === "link-muller-reservas"), false);
  assert.equal(env.__data.shortLinkClicksDaily.some((entry) => entry.short_link_id === "link-muller-reservas"), false);
  assert.equal(env.__data.adminAuditLog.at(-1).action, "short-link.delete");
});

test("configuracao e Central preservam Worker-first e nova experiencia", () => {
  const config = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
  const html = fs.readFileSync("public/admin/portais/index.html", "utf8");
  const script = fs.readFileSync("public/js/modules/admin/portals.js", "utf8");
  assert.ok(config.assets.run_worker_first.includes("/*"));
  assert.match(html, /Links e QR Codes/);
  assert.match(html, /Criador de portais/);
  assert.doesNotMatch(html, /data-content-type="custom_pages"/);
  assert.match(script, /qrcode\.svg/);
  assert.doesNotMatch(html, /Páginas HTML/);
  assert.doesNotMatch(html, /data-unit-panel="modules"/);
});

function adminJson(method, body) {
  return {
    method,
    headers: {
      "content-type": "application/json",
      origin: ADMIN_ORIGIN,
      "x-fioreze-admin-action": "erp-admin",
      "x-fioreze-test-now": "2026-07-12T12:00:00.000Z",
    },
    body: JSON.stringify(body),
  };
}

function grantPermissions(env, permissions) {
  for (const permissionKey of permissions) {
    const permission = env.__data.adminPermissions.find((entry) => entry.permission_key === permissionKey);
    assert.ok(permission, `Permissao ausente na fixture: ${permissionKey}`);
    if (!env.__data.adminRolePermissions.some((entry) => entry.role_id === "role-demo-manager" && entry.permission_id === permission.id)) {
      env.__data.adminRolePermissions.push({ role_id: "role-demo-manager", permission_id: permission.id });
    }
  }
}
