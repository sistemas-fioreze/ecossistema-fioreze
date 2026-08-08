import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  ADMIN_ORIGIN,
  AURORA_USER_ID,
  createErpSessionCookie,
  createSessionCookie,
  withCookie,
} from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

const MUTATION_HEADERS = {
  "x-fioreze-admin-action": "erp-admin",
  origin: ADMIN_ORIGIN,
};

test("migration de feedback preserva identidades separadas e anexo privado", () => {
  const migration = fs.readFileSync("migrations/0045_erp_feedback_messages.sql", "utf8");
  const normalized = migration.replace(/\s+/g, " ").toLowerCase();

  assert.match(normalized, /source_kind/);
  assert.match(normalized, /source_hotel_id/);
  assert.match(normalized, /source_erp_user_id/);
  assert.match(normalized, /attachment_object_key/);
  assert.match(normalized, /'system-erp-support'/);
  assert.match(normalized, /'disabled'/);
  assert.doesNotMatch(normalized, /insert into admin_hotel_access/);
  assert.doesNotMatch(normalized, /insert into admin_user_roles/);
});

test("usuario do ERP envia relato ao Administrador Dev sem ganhar sessao da Central", async () => {
  const { env, json } = createWorkerTestContext();
  const erpCookie = await createErpSessionCookie(env);
  const adminSessionsBefore = env.__data.adminSessions.length;
  const form = feedbackForm("O painel de pedidos nao atualizou depois da busca.");

  const sent = await json(
    "/api/v1/admin/room-service/feedback",
    withCookie(erpCookie, { method: "POST", headers: MUTATION_HEADERS, body: form }),
  );
  const centralSession = await json("/api/v1/admin/session", withCookie(erpCookie));

  assert.equal(sent.response.status, 201);
  assert.equal(sent.body.data.sent, true);
  assert.equal(sent.body.data.screenshot_attached, false);
  assert.equal(centralSession.response.status, 401);
  assert.equal(env.__data.adminSessions.length, adminSessionsBefore);
  assert.equal(env.__data.adminMessages.length, 1);
  assert.equal(env.__data.adminMessages[0].sender_user_id, "system-erp-support");
  assert.equal(env.__data.adminMessages[0].recipient_user_id, "user-demo-admin");
  assert.equal(env.__data.adminMessages[0].source_hotel_id, "muller-fioreze");
  assert.equal(env.__data.adminMessages[0].source_erp_user_id, "erp-user-muller-1");
  assert.equal(env.__data.adminAuditLog.at(-1).action, "room-service.erp_feedback.sent");
});

test("captura de feedback fica privada para o Administrador Dev", async () => {
  const { env, fetch, json } = createWorkerTestContext();
  const erpCookie = await createErpSessionCookie(env);
  const form = feedbackForm("A tela do PDV apresentou desalinhamento no painel lateral.", true);
  const sent = await json(
    "/api/v1/admin/room-service/feedback",
    withCookie(erpCookie, { method: "POST", headers: MUTATION_HEADERS, body: form }),
  );
  const messageId = sent.body.data.message_id;
  const objectKey = env.__data.adminMessages[0].attachment_object_key;
  const devCookie = await createSessionCookie(env);
  const otherCookie = await createSessionCookie(env, AURORA_USER_ID);

  const inbox = await json("/api/v1/admin/messages?box=inbox", withCookie(devCookie));
  const allowed = await fetch(`/api/v1/admin/messages/${messageId}/screenshot`, withCookie(devCookie));
  const denied = await fetch(`/api/v1/admin/messages/${messageId}/screenshot`, withCookie(otherCookie));
  const anonymous = await fetch(`/api/v1/admin/messages/${messageId}/screenshot`);

  assert.equal(sent.response.status, 201);
  assert.equal(sent.body.data.screenshot_attached, true);
  assert.match(objectKey, /^support\/erp-feedback\/muller-fioreze\/\d{4}\/\d{2}\//);
  assert.equal(env.MEDIA_BUCKET.objects.has(objectKey), true);
  assert.equal(inbox.response.status, 200);
  assert.equal(inbox.body.data.messages[0].kind, "erp_feedback");
  assert.equal(inbox.body.data.messages[0].can_reply, false);
  assert.match(inbox.body.data.messages[0].attachment.url, /\/screenshot$/);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("content-type"), "image/png");
  assert.equal(allowed.headers.get("cache-control"), "private, no-store");
  assert.equal(denied.status, 404);
  assert.equal(anonymous.status, 401);
});

test("ERP publica PDV em lista, busca tematizada, feedback e captura descartavel", () => {
  const html = fs.readFileSync("public/erp/room-service/index.html", "utf8");
  const css = fs.readFileSync("public/css/modules/room-service-erp/erp-redesign.css", "utf8");
  const app = fs.readFileSync("public/js/modules/room-service-erp/legacy-app.js", "utf8");
  const messages = fs.readFileSync("public/js/modules/admin/admin-messages.js", "utf8");

  assert.match(html, /erp-redesign\.css/);
  assert.match(css, /\.erp-pdv-list/);
  assert.match(css, /\.erp-pdv-card/);
  assert.match(css, /\.erp-cart-line/);
  assert.match(css, /\.top-search-item\.active/);
  assert.match(css, /var\(--accent\)/);
  assert.match(css, /\.quick-tile\.print/);
  assert.match(css, /transition: width \.34s/);
  assert.match(app, /Algum problema\?/);
  assert.match(app, /getDisplayMedia/);
  assert.match(app, /stream\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(messages, /Captura enviada pelo ERP/);
});

function feedbackForm(description, withScreenshot = false) {
  const form = new FormData();
  form.set("description", description);
  form.set("source_route", "/muller/admin/erp/#vendas");
  if (withScreenshot) {
    form.set(
      "screenshot",
      new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" }),
      "captura-erp.png",
    );
  }
  return form;
}
