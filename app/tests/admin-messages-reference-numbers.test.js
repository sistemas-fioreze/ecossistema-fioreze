import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";
import { ADMIN_ORIGIN, AURORA_USER_ID, createSessionCookie, withCookie } from "./helpers/admin-session.js";

const ADMIN_HEADERS = {
  "content-type": "application/json",
  "x-fioreze-admin-action": "erp-admin",
  origin: ADMIN_ORIGIN,
};

test("migration 0018 cria referências numéricas e caixa de mensagens", () => {
  const migration = fs.readFileSync("migrations/0018_admin_messages_and_reference_numbers.sql", "utf8");
  const normalized = migration.replace(/\s+/g, " ").toLowerCase();

  assert.match(normalized, /alter table admin_users add column user_number integer/);
  assert.match(normalized, /alter table admin_roles add column role_number integer/);
  assert.match(normalized, /create unique index if not exists uq_admin_users_user_number/);
  assert.match(normalized, /create unique index if not exists uq_admin_roles_role_number/);
  assert.match(normalized, /create table if not exists admin_messages/);
  assert.match(normalized, /foreign key \(sender_user_id\) references admin_users\(id\)/);
  assert.match(normalized, /foreign key \(recipient_user_id\) references admin_users\(id\)/);
});

test("usuários e perfis recebem números sequenciais sem substituir IDs internos", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const user = await json(
    "/api/v1/admin/users",
    withCookie(cookie, adminJson("POST", {
      display_name: "Pessoa Fictícia",
      email: "pessoa-ficticia@example.invalid",
      role_ids: [],
      hotel_ids: ["muller-fioreze"],
    })),
  );
  const role = await json(
    "/api/v1/admin/roles",
    withCookie(cookie, adminJson("POST", {
      role_key: "atendimento-ficticio",
      name: "Atendimento fictício",
      description: "Perfil usado somente em teste.",
    })),
  );

  assert.equal(user.response.status, 201);
  assert.equal(user.body.data.user.number, 3);
  assert.match(user.body.data.user.id, /^admin_user_/);
  assert.equal(role.response.status, 201);
  assert.equal(role.body.data.role.number, 3);
  assert.match(role.body.data.role.id, /^role_/);
});

test("destinatários são limitados aos usuários que compartilham uma unidade", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const isolated = await json("/api/v1/admin/messages/recipients", withCookie(cookie));
  env.__data.adminHotelAccess.push({
    user_id: AURORA_USER_ID,
    hotel_id: "muller-fioreze",
    access_level: "manager",
    created_at: "2026-07-12T10:00:00.000Z",
    updated_at: "2026-07-12T10:00:00.000Z",
  });
  const shared = await json("/api/v1/admin/messages/recipients", withCookie(cookie));

  assert.equal(isolated.response.status, 200);
  assert.equal(isolated.body.data.recipients.some((recipient) => recipient.id === AURORA_USER_ID), false);
  assert.equal(shared.body.data.recipients.some((recipient) => recipient.id === AURORA_USER_ID), true);
});

test("mensagem interna pode ser enviada, listada e marcada como lida com auditoria", async () => {
  const { json, env } = createWorkerTestContext();
  env.__data.adminHotelAccess.push({
    user_id: AURORA_USER_ID,
    hotel_id: "muller-fioreze",
    access_level: "manager",
    created_at: "2026-07-12T10:00:00.000Z",
    updated_at: "2026-07-12T10:00:00.000Z",
  });
  const senderCookie = await createSessionCookie(env);
  const recipientCookie = await createSessionCookie(env, AURORA_USER_ID);

  const sent = await json(
    "/api/v1/admin/messages",
    withCookie(senderCookie, adminJson("POST", {
      recipient_user_id: AURORA_USER_ID,
      subject: "Assunto fictício",
      body: "Mensagem interna de teste sem dados reais.",
    })),
  );
  const inbox = await json("/api/v1/admin/messages?box=inbox", withCookie(recipientCookie));
  const read = await json(
    `/api/v1/admin/messages/${encodeURIComponent(sent.body.data.message.id)}/read`,
    withCookie(recipientCookie, adminJson("PATCH", {})),
  );

  assert.equal(sent.response.status, 201);
  assert.equal(inbox.response.status, 200);
  assert.equal(inbox.body.data.messages.length, 1);
  assert.equal(inbox.body.data.messages[0].subject, "Assunto fictício");
  assert.equal(read.response.status, 200);
  assert.equal(read.body.data.changed, true);
  assert.ok(env.__data.adminMessages[0].read_at);
  assert.deepEqual(
    env.__data.adminAuditLog.slice(-2).map((entry) => entry.action),
    ["admin-message.send", "admin-message.read"],
  );
  assert.doesNotMatch(env.__data.adminAuditLog.at(-2).metadata_json, /mensagem interna|assunto fictício/i);
});

test("mensagens bloqueiam ausência de sessão, autoenvio e destinatário isolado", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  const noSession = await json("/api/v1/admin/messages");
  const self = await json(
    "/api/v1/admin/messages",
    withCookie(cookie, adminJson("POST", {
      recipient_user_id: "user-demo-admin",
      subject: "Teste",
      body: "Mensagem fictícia.",
    })),
  );
  const isolated = await json(
    "/api/v1/admin/messages",
    withCookie(cookie, adminJson("POST", {
      recipient_user_id: AURORA_USER_ID,
      subject: "Teste",
      body: "Mensagem fictícia.",
    })),
  );

  assert.equal(noSession.response.status, 401);
  assert.equal(self.response.status, 400);
  assert.equal(isolated.response.status, 404);
  assert.equal(env.__data.adminMessages.length, 0);
});

test("shell inclui mensagens, sessao sem cache, identidade fixa e mídia compacta com ação de mover", () => {
  const html = fs.readFileSync("public/admin/index.html", "utf8");
  const authView = fs.readFileSync("public/js/modules/admin/shared/admin-auth-view.js", "utf8");
  const portals = fs.readFileSync("public/js/modules/admin/portals.js", "utf8");
  const css = fs.readFileSync("public/css/modules/admin/admin.css", "utf8");
  const alignedCss = fs.readFileSync("public/css/modules/admin/admin-erp-aligned.css", "utf8");
  const workspaceCss = fs.readFileSync("public/css/modules/admin/admin-workspace.css", "utf8");

  assert.match(html, /id="messagesManager"/);
  assert.doesNotMatch(authView, /sessionStorage|fioreze-admin-shell-cache/);
  assert.doesNotMatch(authView, /ADMIN_PALETTES|data-admin-palette|burgundy|sunset/);
  assert.match(workspaceCss, /--workspace-sidebar: #ffffff/);
  assert.match(portals, /data-media-action="move"/);
  assert.match(portals, /mediaMoveDialog/);
  assert.match(css, /repeat\(auto-fill, minmax\(142px, 174px\)\)/);
  assert.match(alignedCss, /\.admin-session-trigger[\s\S]*background: #fff/);
});

test("rota visual de mensagens entrega o shell sem redirecionamento em loop", async () => {
  const { fetch } = createWorkerTestContext();
  const redirect = await fetch("/admin/mensagens", { redirect: "manual" });
  const shell = await fetch("/admin/mensagens/", { redirect: "manual" });

  assert.equal(redirect.status, 308);
  assert.equal(new URL(redirect.headers.get("location")).pathname, "/admin/mensagens/");
  assert.equal(shell.status, 200);
  assert.match(await shell.text(), /messagesManager|loginForm/);
});

function adminJson(method, body) {
  return {
    method,
    headers: ADMIN_HEADERS,
    body: JSON.stringify(body),
  };
}
