import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { ADMIN_ORIGIN, AURORA_USER_ID, createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";
import {
  normalizeShortLinkSlug,
  shortLinkPublicUrl,
  validateDestinationUrl,
} from "../src/modules/short-links/shared.js";

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

test("wrangler executa Worker antes de assets para /go/*", () => {
  const config = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
  assert.ok(config.assets.run_worker_first.includes("/go/*"));
});

test("normalizacao de slug aplica regras globais e palavras reservadas", () => {
  assert.equal(normalizeShortLinkSlug(" Reservas-2026 "), "reservas-2026");
  for (const value of ["a", "admin", "go", "-reserva", "reserva-", "reserva--vip", "reserva vip"]) {
    assert.throws(() => normalizeShortLinkSlug(value), /slug/);
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

test("HEAD /go/:slug usa o Worker e nao incrementa analytics", async () => {
  const { fetch, env, flushWaitUntil } = createWorkerTestContext();

  const response = await fetch("/go/reservas", { method: "HEAD", redirect: "manual" });
  await flushWaitUntil();

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://booking.example/muller?origem=link#quartos");
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

test("admin lista links somente do hotel autorizado", async () => {
  const { json, env } = createWorkerTestContext();
  grantPermissions(env, ["portals.links.read"]);
  const cookie = await createSessionCookie(env);

  const response = await json("/api/v1/admin/short-links?hotel_id=muller-fioreze", withCookie(cookie));
  const forbidden = await json("/api/v1/admin/short-links?hotel_id=aurora-demo", withCookie(cookie));

  assert.equal(response.response.status, 200);
  assert.deepEqual(response.body.data.links.map((link) => link.hotel_id), ["muller-fioreze", "muller-fioreze"]);
  assert.equal(forbidden.response.status, 401);
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
  assert.match(created.body.data.link.public_url, /\/go\/whatsapp-demo$/);
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
    "https://go.example.invalid/go/reservas",
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
