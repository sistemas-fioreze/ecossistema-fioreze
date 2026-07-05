import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";

test("GET /admin redireciona uma unica vez para /admin/", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/admin?origem=erp", { redirect: "manual" });
  const location = response.headers.get("location");

  assert.ok([307, 308].includes(response.status));
  assert.ok(location);

  const redirectUrl = new URL(location);
  assert.equal(redirectUrl.pathname, "/admin/");
  assert.equal(redirectUrl.search, "?origem=erp");
  assert.notEqual(redirectUrl.pathname, "/admin");
});

test("GET /admin/ entrega shell administrativo sem Location", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/admin/", { redirect: "manual" });
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  assert.match(text, /ERP Fioreze/);
  assert.equal(response.headers.has("location"), false);
});

test("GET /admin/rota-futura entrega shell administrativo para SPA", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/admin/rota-futura", { redirect: "manual" });
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  assert.match(text, /ERP Fioreze/);
  assert.equal(response.headers.has("location"), false);
});

test("GET /api/v1/admin/session permanece API protegida em JSON", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/api/v1/admin/session", { redirect: "manual" });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  assert.equal(body.error.code, "unauthorized");
});

test("rota administrativa canonica nao passa de um redirect", async () => {
  const { fetch } = createWorkerTestContext();
  const first = await fetch("/admin", { redirect: "manual" });
  assert.equal(first.status, 308);

  const location = new URL(first.headers.get("location"));
  const second = await fetch(`${location.pathname}${location.search}`, { redirect: "manual" });
  const text = await second.text();

  assert.equal(second.status, 200);
  assert.equal(second.headers.has("location"), false);
  assert.match(text, /ERP Fioreze/);
});
