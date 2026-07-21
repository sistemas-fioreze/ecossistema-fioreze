import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { ADMIN_ORIGIN, AURORA_USER_ID, createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";
import {
  extractCustomDomainSlug,
  normalizeShortLinkSlug,
  resolveShortLinkPublicOrigin,
  shortLinkPublicUrl,
  validateDestinationUrl,
} from "../src/modules/short-links/shared.js";

const SHORT_LINK_ORIGIN = "https://go.hoteisfioreze.com.br";
const adminPortalsScript = fs.readFileSync("public/js/modules/admin/portals.js", "utf8");

const LINK_PERMISSIONS = [
  "portals.links.read",
  "portals.links.create",
  "portals.links.update",
  "portals.links.archive",
  "portals.links.analytics",
];

test("migration 0011 cria links curtos, analytics agregada e permissoes sem associar roles", () => {
  const migration = fs.readFileSync("migrations/0011_short_links_foundation.sql", "utf8").toLowerCase();

  assert.match(migration, /create table if not exists short_links/);
  assert.match(migration, /create table if not exists short_link_clicks_daily/);
  assert.match(migration, /unique index if not exists uq_short_links_slug/);
  assert.match(migration, /primary key \(short_link_id, click_date\)/);
  for (const permission of LINK_PERMISSIONS) {
    assert.match(migration, new RegExp(permission.replaceAll(".", "\\.")));
  }
  assert.equal(/admin_role_permissions/i.test(migration), false);
});

test("migration 0024 cria compartilhamento privado sem duplicar acesso", () => {
  const migration = fs.readFileSync("migrations/0024_short_link_user_sharing.sql", "utf8").toLowerCase();

  assert.match(migration, /create table if not exists short_link_user_shares/);
  assert.match(migration, /primary key \(short_link_id, user_id\)/);
  assert.match(migration, /references short_links\(id\) on delete cascade/);
  assert.match(migration, /references admin_users\(id\)/);
  assert.match(migration, /access_level text not null default 'viewer'/);
});

test("Worker e Pages geram o dominio curto oficial sem remover o fallback Workers.dev", () => {
  const worker = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
  const pages = JSON.parse(fs.readFileSync("pages/wrangler.jsonc", "utf8"));
  assert.equal(worker.workers_dev, true);
  assert.ok(worker.assets.run_worker_first.includes("/go/*"));
  assert.equal(worker.vars.SHORT_LINK_PUBLIC_ORIGIN, SHORT_LINK_ORIGIN);
  assert.equal(pages.vars.SHORT_LINK_PUBLIC_ORIGIN, SHORT_LINK_ORIGIN);
  assert.equal((worker.routes || []).some((route) => route.pattern === "go.hoteisfioreze.com.br"), false);
});

test("normalizacao de slug aplica regras globais e palavras reservadas", () => {
  assert.equal(normalizeShortLinkSlug(" Reservas-2026 "), "reservas-2026");
  for (const value of ["a", "admin", "go", "-reserva", "reserva-", "reserva--vip", "reserva vip"]) {
    assert.throws(() => normalizeShortLinkSlug(value), /slug/);
  }
});

test("origem publica oficial aceita somente origem absoluta limpa", () => {
  assert.equal(resolveShortLinkPublicOrigin({ SHORT_LINK_PUBLIC_ORIGIN: SHORT_LINK_ORIGIN }), SHORT_LINK_ORIGIN);
  for (const value of [
    "",
    "go.hoteisfioreze.com.br",
    "ftp://go.hoteisfioreze.com.br",
    "https://go.hoteisfioreze.com.br/campanha",
    "https://go.hoteisfioreze.com.br?x=1",
    "https://go.hoteisfioreze.com.br#top",
    "https://user:pass@go.hoteisfioreze.com.br",
  ]) {
    assert.equal(resolveShortLinkPublicOrigin({ SHORT_LINK_PUBLIC_ORIGIN: value }), null);
  }
});

test("validacao de destino preserva path, query e fragment e bloqueia esquemas perigosos", () => {
  const request = new Request("https://local.test/admin/portais/links/");
  const valid = validateDestinationUrl("https://wa.me/5500000000000?text=ola#top", { request, slug: "whatsapp" });
  assert.equal(valid.scheme, "https");
  assert.equal(valid.url, "https://wa.me/5500000000000?text=ola#top");
  assert.deepEqual(validateDestinationUrl("http://example.invalid", { request, slug: "site" }).warnings, ["http_destination"]);
  for (const value of ["javascript:alert(1)", "data:text/html,1", "/relativo", "https://user:pass@example.invalid", "https://local.test/go/loop"]) {
    assert.throws(() => validateDestinationUrl(value, { request, slug: "loop" }), /destination_url/);
  }
});

test("validacao de destino bloqueia loops no dominio oficial e rota tecnica", () => {
  const request = new Request("https://fioreze-portais-dev.marketing1-840.workers.dev/admin/portais/links/");
  const env = { SHORT_LINK_PUBLIC_ORIGIN: SHORT_LINK_ORIGIN };
  for (const value of [
    `${SHORT_LINK_ORIGIN}/reservas`,
    `${SHORT_LINK_ORIGIN}/reservas/`,
    `${SHORT_LINK_ORIGIN}/go/reservas`,
    "https://fioreze-portais-dev.marketing1-840.workers.dev/go/reservas",
    `${SHORT_LINK_ORIGIN}/%72eservas`,
  ]) {
    assert.throws(() => validateDestinationUrl(value, { request, env, slug: "reservas" }), /proprio link curto/);
  }

  assert.equal(
    validateDestinationUrl("https://hoteisfioreze.com.br/reservas", { request, env, slug: "reservas" }).url,
    "https://hoteisfioreze.com.br/reservas",
  );
});

test("GET /go/:slug redireciona sem cache e registra analytics agregada", async () => {
  const { fetch, env, flushWaitUntil } = createWorkerTestContext();

  const response = await fetch("/go/reservas", {
    redirect: "manual",
    headers: { "x-fioreze-test-now": "2026-07-12T12:00:00.000Z" },
  });
  await flushWaitUntil();
  const link = env.__data.shortLinks.find((entry) => entry.slug === "reservas");

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://booking.example/muller?origem=link#quartos");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(link.total_clicks, 1);
  assert.equal(link.last_clicked_at, "2026-07-12T12:00:00.000Z");
  assert.equal(env.__data.shortLinkClicksDaily[0].click_date, "2026-07-12");
  assert.equal(Object.hasOwn(env.__data.shortLinkClicksDaily[0], "user_agent"), false);
});

test("dominio oficial /:slug redireciona e registra analytics sem anexar query do visitante", async () => {
  const { fetch, env, flushWaitUntil } = createWorkerTestContext({ SHORT_LINK_PUBLIC_ORIGIN: SHORT_LINK_ORIGIN });

  const response = await fetch(`${SHORT_LINK_ORIGIN}/reservas?utm_visitante=nao-copiar`, {
    redirect: "manual",
    headers: { "x-fioreze-test-now": "2026-07-12T12:00:00.000Z" },
  });
  await flushWaitUntil();
  const link = env.__data.shortLinks.find((entry) => entry.slug === "reservas");

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://booking.example/muller?origem=link#quartos");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(link.total_clicks, 1);
  assert.equal(env.__data.shortLinkClicksDaily[0].click_count, 1);
});

test("HEAD /go/:slug usa o Worker e nao incrementa analytics", async () => {
  const { fetch, env, flushWaitUntil } = createWorkerTestContext();

  const response = await fetch("/go/reservas", { method: "HEAD", redirect: "manual" });
  await flushWaitUntil();

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://booking.example/muller?origem=link#quartos");
  assert.equal(env.__data.shortLinks.find((entry) => entry.slug === "reservas").total_clicks, 0);
});

test("HEAD no dominio oficial retorna o mesmo Location sem incrementar analytics", async () => {
  const { fetch, env, flushWaitUntil } = createWorkerTestContext({ SHORT_LINK_PUBLIC_ORIGIN: SHORT_LINK_ORIGIN });

  const custom = await fetch(`${SHORT_LINK_ORIGIN}/reservas`, { method: "HEAD", redirect: "manual" });
  const technical = await fetch("/go/reservas", { method: "HEAD", redirect: "manual" });
  await flushWaitUntil();

  assert.equal(custom.status, 302);
  assert.equal(technical.status, 302);
  assert.equal(custom.headers.get("location"), technical.headers.get("location"));
  assert.equal(custom.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(env.__data.shortLinks.find((entry) => entry.slug === "reservas").total_clicks, 0);
});

test("links indisponiveis retornam 404 generico sem HTML do SPA", async () => {
  const { fetch, env } = createWorkerTestContext();
  env.__data.shortLinks.push({
    ...env.__data.shortLinks[0],
    id: "link-expirado",
    slug: "expirado",
    status: "active",
    expires_at: "2026-07-01T00:00:00.000Z",
  });

  for (const slug of ["inexistente", "pausado", "expirado"]) {
    const response = await fetch(`/go/${slug}`, {
      redirect: "manual",
      headers: { "x-fioreze-test-now": "2026-07-12T12:00:00.000Z" },
    });
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type") || "", /application\/json/);
    assert.equal(response.headers.has("location"), false);
  }
});

test("hostname oficial isola admin, api, assets e fallback SPA", async () => {
  const { fetch, env, flushWaitUntil } = createWorkerTestContext({ SHORT_LINK_PUBLIC_ORIGIN: SHORT_LINK_ORIGIN });
  const paths = [
    "/",
    "/admin",
    "/admin/",
    "/api",
    "/api/v1/health",
    "/assets",
    "/css",
    "/js",
    "/embed",
    "/media",
    "/go",
    "/go/reservas",
    "/login",
    "/logout",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
    "/cdn-cgi",
    "/.well-known",
    "/pasta/reservas",
    "/reservas/extra",
  ];

  for (const path of paths) {
    const response = await fetch(`${SHORT_LINK_ORIGIN}${path}`, { redirect: "manual" });
    assert.equal(response.status, 404, path);
    assert.match(response.headers.get("content-type") || "", /application\/json/, path);
    assert.equal(response.headers.get("cache-control"), "no-store", path);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow", path);
    assert.equal(response.headers.has("location"), false, path);
    assert.equal(response.headers.has("set-cookie"), false, path);
    assert.doesNotMatch(await response.text(), /Central de Portais|<!doctype html/i, path);
  }

  const post = await fetch(`${SHORT_LINK_ORIGIN}/reservas`, { method: "POST", redirect: "manual" });
  assert.equal(post.status, 404);
  await flushWaitUntil();
  assert.equal(env.__data.shortLinks.find((entry) => entry.slug === "reservas").total_clicks, 0);
});

test("hostname oficial bloqueia reservados codificados, traversal e encoding invalido", async () => {
  const { fetch, env, flushWaitUntil } = createWorkerTestContext({ SHORT_LINK_PUBLIC_ORIGIN: SHORT_LINK_ORIGIN });
  for (const path of ["/admin", "/%61dmin", "/%2e%2e", "/%2Fadmin", "/admin%2Fteste", "/%E0%A4%A"]) {
    const response = await fetch(`${SHORT_LINK_ORIGIN}${path}`, { redirect: "manual" });
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.has("location"), false, path);
  }
  await flushWaitUntil();
  assert.equal(env.__data.shortLinks.find((entry) => entry.slug === "reservas").total_clicks, 0);
  assert.equal(extractCustomDomainSlug("/reservas/"), "reservas");
});

test("workers.dev preserva /go/:slug e nao transforma /:slug em link curto", async () => {
  const { fetch, env, flushWaitUntil } = createWorkerTestContext({ SHORT_LINK_PUBLIC_ORIGIN: SHORT_LINK_ORIGIN });

  const technical = await fetch("/go/reservas", { redirect: "manual" });
  const plain = await fetch("/reservas", { redirect: "manual" });
  const otherHost = await fetch("https://outro.example.invalid/reservas", { redirect: "manual" });
  await flushWaitUntil();

  assert.equal(technical.status, 302);
  assert.equal(plain.status, 200);
  assert.match(await plain.text(), /<body>\/<\/body>/);
  assert.equal(otherHost.status, 200);
  assert.equal(env.__data.shortLinks.find((entry) => entry.slug === "reservas").total_clicks, 1);
});

test("admin lista links somente do hotel autorizado", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env, ["portals.links.read"]);
  const cookie = await createSessionCookie(env);

  const response = await json("/api/v1/admin/short-links?hotel_id=muller-fioreze", withCookie(cookie));
  const forbidden = await json("/api/v1/admin/short-links?hotel_id=aurora-demo", withCookie(cookie));

  assert.equal(response.response.status, 200);
  assert.deepEqual(response.body.data.links.map((link) => link.hotel_id), ["muller-fioreze", "muller-fioreze"]);
  assert.equal(response.body.data.public_url_base, `${ADMIN_ORIGIN}/go`);
  assert.equal(forbidden.response.status, 401);
});

test("links ficam privados para o criador ate um compartilhamento explicito", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const ownerCookie = await createSessionCookie(env);
  const viewerId = addMullerViewer(env);
  const viewerCookie = await createSessionCookie(env, viewerId);

  const before = await json("/api/v1/admin/short-links?hotel_id=muller-fioreze", withCookie(viewerCookie));
  const shared = await json(
    "/api/v1/admin/short-links/link-muller-reservas/shares",
    withCookie(ownerCookie, adminJson("POST", { user_id: viewerId })),
  );
  const after = await json("/api/v1/admin/short-links?hotel_id=muller-fioreze", withCookie(viewerCookie));
  const detail = await json("/api/v1/admin/short-links/link-muller-reservas", withCookie(viewerCookie));

  assert.equal(before.response.status, 200);
  assert.deepEqual(before.body.data.links, []);
  assert.equal(shared.response.status, 200);
  assert.equal(shared.body.data.shared, true);
  assert.deepEqual(after.body.data.links.map((link) => link.id), ["link-muller-reservas"]);
  assert.equal(after.body.data.links[0].access_level, "viewer");
  assert.equal(after.body.data.links[0].can_manage, false);
  assert.equal(detail.body.data.link.can_manage, false);
  assert.equal(env.__data.adminAuditLog.at(-1).action, "short-link.share");
});

test("usuario compartilhado consulta QR e metricas mas nao altera nem gerencia o link", async () => {
  const { fetch, json, env } = createWorkerTestContext();
  grantPermissions(env);
  const viewerId = addMullerViewer(env);
  env.__data.shortLinkUserShares.push({
    short_link_id: "link-muller-reservas",
    user_id: viewerId,
    shared_by_user_id: "user-demo-admin",
    access_level: "viewer",
    created_at: "2026-07-12T12:00:00.000Z",
  });
  const cookie = await createSessionCookie(env, viewerId);

  const qr = await fetch("/api/v1/admin/short-links/link-muller-reservas/qrcode.svg", withCookie(cookie));
  const analytics = await json("/api/v1/admin/short-links/link-muller-reservas/analytics", withCookie(cookie));
  const update = await json(
    "/api/v1/admin/short-links/link-muller-reservas",
    withCookie(cookie, adminJson("PATCH", { status: "paused" })),
  );
  const shares = await json("/api/v1/admin/short-links/link-muller-reservas/shares", withCookie(cookie));
  const archive = await json(
    "/api/v1/admin/short-links/link-muller-reservas",
    withCookie(cookie, adminJson("DELETE", {})),
  );

  assert.equal(qr.status, 200);
  assert.match(qr.headers.get("content-type") || "", /image\/svg\+xml/);
  assert.equal(analytics.response.status, 200);
  assert.equal(update.response.status, 404);
  assert.equal(shares.response.status, 404);
  assert.equal(archive.response.status, 404);
  assert.equal(env.__data.shortLinks.find((link) => link.id === "link-muller-reservas").status, "active");
});

test("proprietario revoga compartilhamento e o link volta a ficar invisivel", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const ownerCookie = await createSessionCookie(env);
  const viewerId = addMullerViewer(env);
  const viewerCookie = await createSessionCookie(env, viewerId);

  await json(
    "/api/v1/admin/short-links/link-muller-reservas/shares",
    withCookie(ownerCookie, adminJson("POST", { user_id: viewerId })),
  );
  const candidates = await json("/api/v1/admin/short-links/link-muller-reservas/shares", withCookie(ownerCookie));
  const revoked = await json(
    `/api/v1/admin/short-links/link-muller-reservas/shares/${viewerId}`,
    withCookie(ownerCookie, adminJson("DELETE", {})),
  );
  const hidden = await json("/api/v1/admin/short-links/link-muller-reservas", withCookie(viewerCookie));

  assert.equal(candidates.response.status, 200);
  assert.equal(candidates.body.data.users.find((user) => user.id === viewerId).shared, true);
  assert.equal(revoked.body.data.revoked, true);
  assert.equal(hidden.response.status, 404);
  assert.equal(env.__data.shortLinkUserShares.length, 0);
  assert.equal(env.__data.adminAuditLog.at(-1).action, "short-link.share-revoke");
});

test("proprietario nao compartilha link com usuario sem acesso a unidade", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);

  const response = await json(
    "/api/v1/admin/short-links/link-muller-reservas/shares",
    withCookie(cookie, adminJson("POST", { user_id: AURORA_USER_ID })),
  );

  assert.equal(response.response.status, 403);
  assert.equal(env.__data.shortLinkUserShares.length, 0);
});

test("gestao de compartilhamento exige permissao de atualizar links", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env, ["portals.links.read"]);
  const cookie = await createSessionCookie(env);

  const response = await json("/api/v1/admin/short-links/link-muller-reservas/shares", withCookie(cookie));

  assert.equal(response.response.status, 401);
});

test("admin gera links e preview com a origem oficial configurada", async () => {
  const { json, env } = createWorkerTestContext({ SHORT_LINK_PUBLIC_ORIGIN: SHORT_LINK_ORIGIN });
  grantPermissions(env);
  const cookie = await createSessionCookie(env);

  const list = await json("/api/v1/admin/short-links?hotel_id=muller-fioreze", withCookie(cookie));
  const created = await json(
    "/api/v1/admin/short-links",
    withCookie(cookie, adminJson("POST", {
      hotel_id: "muller-fioreze",
      internal_name: "Campanha oficial demo",
      slug: "campanha-oficial-demo",
      destination_url: "https://example.invalid/campanha",
      status: "active",
    })),
  );

  assert.equal(list.body.data.public_url_base, SHORT_LINK_ORIGIN);
  assert.equal(created.body.data.link.public_url, `${SHORT_LINK_ORIGIN}/campanha-oficial-demo`);
  assert.match(adminPortalsScript, /payload\.data\.public_url_base/);
  assert.match(adminPortalsScript, /const base = currentShortLinkPublicBase/);
});

test("admin cria link, rejeita duplicidade e nao grava destino completo no audit", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);
  const body = {
    hotel_id: "muller-fioreze",
    internal_name: "WhatsApp demo",
    slug: "whatsapp-demo",
    destination_url: "https://wa.me/5500000000000?text=demo",
    status: "active",
  };

  const created = await json("/api/v1/admin/short-links", withCookie(cookie, adminJson("POST", body)));
  const duplicate = await json("/api/v1/admin/short-links", withCookie(cookie, adminJson("POST", body)));
  const audit = env.__data.adminAuditLog.at(-1);

  assert.equal(created.response.status, 200);
  assert.equal(created.body.data.link.public_url, `${ADMIN_ORIGIN}/go/whatsapp-demo`);
  assert.equal(duplicate.response.status, 409);
  assert.equal(audit.action, "short-link.create");
  assert.equal(audit.metadata_json.includes("wa.me"), false);
});

test("admin atualiza destino e status sem permitir alterar slug ou hotel", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);

  const blocked = await json(
    "/api/v1/admin/short-links/link-muller-reservas",
    withCookie(cookie, adminJson("PATCH", { slug: "novo", hotel_id: "aurora-demo" })),
  );
  const updated = await json(
    "/api/v1/admin/short-links/link-muller-reservas",
    withCookie(cookie, adminJson("PATCH", { destination_url: "https://example.invalid/novo?campanha=demo", status: "paused" })),
  );
  const audit = env.__data.adminAuditLog.at(-1);

  assert.equal(blocked.response.status, 400);
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.link.slug, "reservas");
  assert.equal(updated.body.data.link.status, "paused");
  assert.deepEqual(JSON.parse(audit.metadata_json).changed_fields, ["destination_url", "status"]);
  assert.equal(audit.metadata_json.includes("campanha=demo"), false);
});

test("admin arquiva link por soft delete e analytics permanece disponivel", async () => {
  const { fetch, json, env, flushWaitUntil } = createWorkerTestContext();
  grantPermissions(env);
  const cookie = await createSessionCookie(env);
  await fetch("/go/reservas", { redirect: "manual", headers: { "x-fioreze-test-now": "2026-07-12T12:00:00.000Z" } });
  await flushWaitUntil();

  const archived = await json(
    "/api/v1/admin/short-links/link-muller-reservas",
    withCookie(cookie, adminJson("DELETE", {})),
  );
  const analytics = await json("/api/v1/admin/short-links/link-muller-reservas/analytics", withCookie(cookie));
  const publicResponse = await fetch("/go/reservas", { redirect: "manual" });

  assert.equal(archived.response.status, 200);
  assert.equal(archived.body.data.link.status, "archived");
  assert.equal(analytics.response.status, 200);
  assert.equal(analytics.body.data.analytics.total_clicks, 1);
  assert.equal(publicResponse.status, 404);
});

test("usuario de outro hotel nao confirma existencia do link", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env, LINK_PERMISSIONS);
  const cookie = await createSessionCookie(env, AURORA_USER_ID);

  const detail = await json("/api/v1/admin/short-links/link-muller-reservas", withCookie(cookie));
  const archive = await json(
    "/api/v1/admin/short-links/link-muller-reservas",
    withCookie(cookie, adminJson("DELETE", {})),
  );

  assert.equal(detail.response.status, 404);
  assert.equal(archive.response.status, 404);
});

test("Central de Portais entrega shell para /admin/portais/links sem loop", async () => {
  const { fetch } = createWorkerTestContext();

  const redirect = await fetch("/admin/portais/links", { redirect: "manual" });
  const shell = await fetch("/admin/portais/links/", { redirect: "manual" });

  assert.equal(redirect.status, 308);
  assert.equal(new URL(redirect.headers.get("location")).pathname, "/admin/portais/links/");
  assert.equal(shell.status, 200);
  assert.match(await shell.text(), /shortLinksManager/);
});

test("origem publica opcional monta URL curta sem persistir dominio", () => {
  const request = new Request("https://local.test/admin/portais/links/");
  assert.equal(shortLinkPublicUrl({ env: {}, request, slug: "reservas" }), "https://local.test/go/reservas");
  assert.equal(
    shortLinkPublicUrl({ env: { SHORT_LINK_PUBLIC_ORIGIN: "https://go.example.invalid/" }, request, slug: "reservas" }),
    "https://go.example.invalid/reservas",
  );
  assert.equal(
    shortLinkPublicUrl({ env: { SHORT_LINK_PUBLIC_ORIGIN: "https://go.example.invalid/path" }, request, slug: "reservas" }),
    "https://local.test/go/reservas",
  );
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

function grantPermissions(env, permissions = LINK_PERMISSIONS) {
  for (const permissionKey of permissions) {
    const permission = env.__data.adminPermissions.find((entry) => entry.permission_key === permissionKey);
    if (!permission) continue;
    const exists = env.__data.adminRolePermissions.some(
      (entry) => entry.role_id === "role-demo-manager" && entry.permission_id === permission.id,
    );
    if (!exists) env.__data.adminRolePermissions.push({ role_id: "role-demo-manager", permission_id: permission.id });
  }
}

function addMullerViewer(env) {
  const id = "user-muller-viewer";
  env.__data.adminUsers.push({
    ...env.__data.adminUsers.find((user) => user.id === AURORA_USER_ID),
    id,
    user_number: 3,
    display_name: "Pessoa Compartilhada",
    email: "viewer@example.invalid",
  });
  env.__data.adminUserRoles.push({ user_id: id, role_id: "role-demo-manager" });
  env.__data.adminHotelAccess.push({ user_id: id, hotel_id: "muller-fioreze", access_level: "viewer" });
  return id;
}
