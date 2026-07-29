import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";

const NOT_FOUND_TEXT = "A página solicitada não pode ser encontrada.";
const OFFICIAL_PORTAL_ORIGIN = "https://portal.hoteisfioreze.com.br";
const SHORT_LINK_ORIGIN = "https://go.hoteisfioreze.com.br";

test("pagina 404 publica e minimalista, responsiva e usa a marca da Central", () => {
  const html = fs.readFileSync("public/not-found/index.html", "utf8");
  const layout = fs.readFileSync("public/css/core/layout.css", "utf8");
  const errors = fs.readFileSync("public/js/core/errors.js", "utf8");
  const app = fs.readFileSync("public/js/core/app.js", "utf8");

  assert.match(html, /<h1 id="notFoundTitle">404<\/h1>/);
  assert.match(html, new RegExp(NOT_FOUND_TEXT.replace(".", "\\.")));
  assert.match(html, /fioreze-central-logo\.jpg/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.doesNotMatch(html, /<(?:input|form)\b|slug|Hotel nao informado|Link nao encontrado/i);
  assert.match(layout, /\.public-not-found-root/);
  assert.match(layout, /\.public-not-found h1/);
  assert.match(errors, /export function renderNotFound/);
  assert.match(errors, new RegExp(NOT_FOUND_TEXT.replace(".", "\\.")));
  assert.match(app, /if \(!slug\)\s*\{\s*renderNotFound\(app\)/);
  assert.match(app, /if \(!enabledModules\.has\(requestedModule\)\)/);
  assert.match(app, /error\?\.status === 404/);
});

test("navegacao publica inexistente devolve HTTP 404 com a mesma pagina", async () => {
  const { fetch } = createWorkerTestContext({
    GUEST_PORTAL_PUBLIC_ORIGIN: OFFICIAL_PORTAL_ORIGIN,
  });
  const paths = [
    "/",
    "/hotel-inexistente",
    "/muller-fioreze/spa",
    "/muller-fioreze/modulo-inexistente",
    "/muller-fioreze/pagina/antiga",
  ];

  for (const path of paths) {
    const response = await fetch(`${OFFICIAL_PORTAL_ORIGIN}${path}`, { redirect: "manual" });
    assert.equal(response.status, 404, path);
    assert.match(response.headers.get("content-type") || "", /text\/html/, path);
    assert.equal(response.headers.get("cache-control"), "no-store", path);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow", path);
    const html = await response.text();
    assert.match(html, />404</, path);
    assert.match(html, new RegExp(NOT_FOUND_TEXT.replace(".", "\\.")), path);
    assert.match(html, /fioreze-central-logo\.jpg/, path);
    assert.doesNotMatch(html, /slug|Hotel nao informado|Nao foi possivel continuar/i, path);
  }
});

test("hotel e modulo existentes continuam servindo o portal", async () => {
  const { fetch } = createWorkerTestContext();
  for (const path of ["/muller-fioreze", "/muller-fioreze/room-service"]) {
    const response = await fetch(path, { redirect: "manual" });
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type") || "", /text\/html/, path);
  }
});

test("APIs 404 permanecem JSON e nao recebem a pagina visual", async () => {
  const { fetch } = createWorkerTestContext();
  const response = await fetch("/api/v1/public/hotels/hotel-inexistente/bootstrap");
  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "not_found");
});

test("link curto inexistente usa logo do portal e HEAD nao devolve body", async () => {
  const { fetch } = createWorkerTestContext({
    GUEST_PORTAL_PUBLIC_ORIGIN: OFFICIAL_PORTAL_ORIGIN,
    SHORT_LINK_PUBLIC_ORIGIN: SHORT_LINK_ORIGIN,
  });

  const get = await fetch(`${SHORT_LINK_ORIGIN}/nao-existe`, { redirect: "manual" });
  assert.equal(get.status, 404);
  const html = await get.text();
  assert.match(html, new RegExp(`${OFFICIAL_PORTAL_ORIGIN}/assets/shared/fioreze-central-logo\\.jpg`));
  assert.match(html, new RegExp(NOT_FOUND_TEXT.replace(".", "\\.")));

  const head = await fetch(`${SHORT_LINK_ORIGIN}/nao-existe`, {
    method: "HEAD",
    redirect: "manual",
  });
  assert.equal(head.status, 404);
  assert.match(head.headers.get("content-type") || "", /text\/html/);
  assert.equal(await head.text(), "");
});
