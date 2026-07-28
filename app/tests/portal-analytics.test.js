import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

const visitHeaders = {
  "content-type": "application/json",
  "x-fioreze-test-now": "2026-07-12T13:00:00.000Z",
  "cf-ipcountry": "BR",
  "x-fioreze-test-region": "Rio Grande do Sul",
};

test("acessos ao portal deduplicam visitante por dia, pagina e IP protegido", async () => {
  const { json, env } = createWorkerTestContext();
  const visit = (pageKey, ip, now = "2026-07-12T13:00:00.000Z") => json(
    "/api/v1/public/hotels/muller-fioreze/portal/analytics/visit",
    { method: "POST", headers: { ...visitHeaders, "x-forwarded-for": ip, "x-fioreze-test-now": now }, body: JSON.stringify({ page_key: pageKey }) },
  );

  assert.equal((await visit("inicio", "203.0.113.10")).response.status, 202);
  assert.equal((await visit("inicio", "203.0.113.10", "2026-07-12T14:00:00.000Z")).response.status, 202);
  assert.equal((await visit("eventos", "203.0.113.10")).response.status, 202);
  assert.equal((await visit("inicio", "203.0.113.11")).response.status, 202);

  assert.equal(env.__data.portalVisitVisitors.length, 3);
  assert.equal(env.__data.portalVisitVisitors.find((entry) => entry.page_key === "inicio" && entry.visit_count === 2).visit_count, 2);
  assert.equal(JSON.stringify(env.__data.portalVisitVisitors).includes("203.0.113.10"), false);
});

test("painel administrativo agrega portais por data, pagina, horario e local sem cruzar unidades", async () => {
  const { json, env } = createWorkerTestContext();
  grantAnalyticsPermission(env);
  env.__data.adminUsers.find((user) => user.id === "user-demo-admin").user_number = 99;
  const cookie = await createSessionCookie(env);
  env.__data.portalVisitVisitors.push(
    portalVisit("muller-fioreze", "inicio", "visitor-a", 2, "12:10:00.000Z"),
    portalVisit("muller-fioreze", "eventos", "visitor-a", 1, "13:10:00.000Z"),
    portalVisit("muller-fioreze", "inicio", "visitor-b", 1, "14:10:00.000Z"),
    portalVisit("aurora-demo", "inicio", "visitor-aurora", 9, "15:10:00.000Z"),
  );

  const result = await json(
    "/api/v1/admin/portal-analytics?hotel_id=muller-fioreze&from=2026-07-12&to=2026-07-12&region=grande",
    withCookie(cookie),
  );
  assert.equal(result.response.status, 200);
  assert.equal(result.body.data.analytics.unique_visitors, 2);
  assert.equal(result.body.data.analytics.total_visits, 4);
  assert.equal(result.body.data.analytics.repeated_visits, 2);
  assert.equal(result.body.data.analytics.pages.length, 2);
  assert.equal(result.body.data.analytics.locations[0].region, "Rio Grande do Sul");
  assert.equal(result.body.data.analytics.hourly.length, 3);

  const forbidden = await json(
    "/api/v1/admin/portal-analytics?hotel_id=aurora-demo&from=2026-07-12&to=2026-07-12",
    withCookie(cookie),
  );
  assert.equal(forbidden.response.status, 401);
});

test("frontend registra abertura inicial e troca interna de guia", () => {
  const app = fs.readFileSync("public/js/core/app.js", "utf8");
  const portal = fs.readFileSync("public/js/core/portal-home.js", "utf8");
  const analytics = fs.readFileSync("public/js/core/analytics.js", "utf8");
  assert.match(app, /trackPortalVisit\(slug, portalPageKey\(moduleKey\)\)/);
  assert.match(portal, /trackPortalVisit\(state\.bootstrap\.slug, nextTab\)/);
  assert.match(analytics, /credentials: "omit"/);
  assert.match(analytics, /keepalive: true/);
});

test("Links e QR Codes ocupa o workspace e oferece filtros, graficos e reset unico", () => {
  const html = fs.readFileSync("public/admin/portais/index.html", "utf8");
  const css = fs.readFileSync("public/css/modules/admin/admin-workspace.css", "utf8");
  assert.match(html, /id="shortLinksSearch"/);
  assert.match(html, /data-analytics-view="portals"/);
  assert.match(html, /id="portalAnalyticsDaily"/);
  assert.match(html, /id="portalAnalyticsLocations"/);
  assert.match(html, /id="resetShortLinkAnalyticsButton"/);
  assert.match(css, /data-active-portal-section="shortLinksManager"/);
  assert.match(css, /\.admin-analytics-dashboard/);
});

function portalVisit(hotel_id, page_key, visitor_hash, visit_count, time) {
  return { hotel_id, page_key, visit_date: "2026-07-12", visitor_hash, country_code: "BR", region: "Rio Grande do Sul", first_visited_at: `2026-07-12T${time}`, last_visited_at: `2026-07-12T${time}`, visit_count };
}

function grantAnalyticsPermission(env) {
  const permission = env.__data.adminPermissions.find((entry) => entry.permission_key === "portals.links.analytics");
  if (!env.__data.adminRolePermissions.some((entry) => entry.role_id === "role-demo-manager" && entry.permission_id === permission.id)) {
    env.__data.adminRolePermissions.push({ role_id: "role-demo-manager", permission_id: permission.id });
  }
}
