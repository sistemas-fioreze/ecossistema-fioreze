import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createWorkerTestContext } from "./helpers/worker.js";
import { ADMIN_ORIGIN, AURORA_USER_ID, createSessionCookie, withCookie } from "./helpers/admin-session.js";

const ADMIN_HEADERS = {
  "content-type": "application/json",
  "x-fioreze-admin-action": "erp-admin",
  origin: ADMIN_ORIGIN,
  "x-fioreze-test-now": "2026-07-12T12:00:00.000Z",
};

test("usuarios administrativos listam dados seguros sem hash ou token", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env, AURORA_USER_ID);

  const { response, body } = await json("/api/v1/admin/users", withCookie(cookie));

  assert.equal(response.status, 200);
  assert.ok(body.data.users.length >= 1);
  assert.equal(body.data.users[0].email, "admin-demo@example.invalid");
  assert.doesNotMatch(JSON.stringify(body), /password_hash|token_hash|user_agent|ip_hash|pbkdf/i);
});

test("usuarios administrativos exigem permissao especifica", async () => {
  const { json, env } = createWorkerTestContext();
  env.__data.adminRolePermissions = env.__data.adminRolePermissions.filter(
    (entry) => !env.__data.adminPermissions.find((permission) => permission.id === entry.permission_id)?.permission_key.startsWith("admin.users."),
  );
  const cookie = await createSessionCookie(env, AURORA_USER_ID);

  const { response, body } = await json("/api/v1/admin/users", withCookie(cookie));

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "unauthorized");
});

test("criacao de usuario gera senha temporaria uma vez e audita sem segredo", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const { response, body } = await json(
    "/api/v1/admin/users",
    withCookie(cookie, adminJson("POST", {
      display_name: "Pessoa Demo",
      email: "pessoa-demo@example.invalid",
      role_ids: ["role-demo-manager"],
      hotel_ids: ["muller-fioreze"],
    })),
  );

  assert.equal(response.status, 201);
  assert.match(body.data.temporary_password, /^[A-Za-z0-9]{24}$/);
  assert.equal(body.data.user.force_password_change, true);
  assert.doesNotMatch(JSON.stringify(body.data.user), /password_hash|token_hash|pbkdf/i);
  assert.equal(env.__data.adminUsers.some((user) => user.email === "pessoa-demo@example.invalid"), true);
  assert.equal(env.__data.adminAuditLog.at(-1).action, "admin-user.create");
  assert.doesNotMatch(env.__data.adminAuditLog.at(-1).metadata_json, /password|hash|token/i);
});

test("criacao de usuario bloqueia email duplicado e unidade fora do acesso", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env, AURORA_USER_ID);

  const duplicate = await json(
    "/api/v1/admin/users",
    withCookie(cookie, adminJson("POST", {
      display_name: "Duplicado",
      email: "admin-demo@example.invalid",
      role_ids: ["role-demo-manager"],
      hotel_ids: ["aurora-demo"],
    })),
  );
  const otherHotel = await json(
    "/api/v1/admin/users",
    withCookie(cookie, adminJson("POST", {
      display_name: "Outro Hotel",
      email: "outro-hotel@example.invalid",
      role_ids: ["role-demo-manager"],
      hotel_ids: ["muller-fioreze"],
    })),
  );

  assert.equal(duplicate.response.status, 409);
  assert.equal(otherHotel.response.status, 403);
});

test("desativacao bloqueia propria conta e ultimo administrador efetivo", async () => {
  const { json, env } = createWorkerTestContext();
  env.__data.adminRoles.push({ id: "role-disable-operator", role_key: "disable-operator", name: "Operador de bloqueio" });
  env.__data.adminUserRoles = [{ user_id: "user-demo-admin", role_id: "role-disable-operator" }, { user_id: "user-aurora-admin", role_id: "role-demo-manager" }];
  env.__data.adminRolePermissions.push({ role_id: "role-disable-operator", permission_id: "perm-admin-users-disable" });
  const cookie = await createSessionCookie(env);

  const self = await json("/api/v1/admin/users/user-demo-admin/disable", withCookie(cookie, adminJson("POST", {})));
  const other = await json("/api/v1/admin/users/user-aurora-admin/disable", withCookie(cookie, adminJson("POST", {})));

  assert.equal(self.response.status, 409);
  assert.equal(other.response.status, 409);
  assert.equal(env.__data.adminUsers.find((user) => user.id === "user-aurora-admin").status, "active");
});

test("reset administrativo de senha revoga sessoes e nao persiste segredo em auditoria", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  await createSessionCookie(env, "user-aurora-admin");

  const { response, body } = await json(
    "/api/v1/admin/users/user-aurora-admin/password-reset",
    withCookie(cookie, adminJson("POST", {})),
  );

  assert.equal(response.status, 200);
  assert.match(body.data.temporary_password, /^[A-Za-z0-9]{24}$/);
  assert.equal(env.__data.adminUsers.find((user) => user.id === "user-aurora-admin").force_password_change, 1);
  assert.ok(env.__data.adminSessions.find((session) => session.user_id === "user-aurora-admin").revoked_at);
  assert.equal(env.__data.adminAuditLog.at(-1).action, "admin-user.password-reset");
  assert.doesNotMatch(env.__data.adminAuditLog.at(-1).metadata_json, /password|hash|token/i);
});

test("remocao de usuario arquiva conta, revoga sessoes e remove vinculos", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  const created = await json(
    "/api/v1/admin/users",
    withCookie(cookie, adminJson("POST", {
      display_name: "Pessoa Removivel",
      email: "removivel@example.invalid",
      role_ids: [],
      hotel_ids: ["muller-fioreze"],
    })),
  );
  const userId = created.body.data.user.id;
  env.__data.adminSessions.push({ id: "session-removivel", user_id: userId, token_hash: "test-only", expires_at: "2026-08-01T00:00:00.000Z", revoked_at: null });

  const removed = await json(`/api/v1/admin/users/${userId}`, withCookie(cookie, adminJson("DELETE", {})));
  const listed = await json("/api/v1/admin/users", withCookie(cookie));
  const stored = env.__data.adminUsers.find((user) => user.id === userId);

  assert.equal(removed.response.status, 200);
  assert.equal(removed.body.data.removed, true);
  assert.equal(stored.status, "archived");
  assert.ok(stored.archived_at);
  assert.ok(env.__data.adminSessions.find((session) => session.id === "session-removivel").revoked_at);
  assert.equal(env.__data.adminHotelAccess.some((entry) => entry.user_id === userId), false);
  assert.equal(env.__data.adminUserRoles.some((entry) => entry.user_id === userId), false);
  assert.equal(listed.body.data.users.some((user) => user.id === userId), false);
  assert.equal(env.__data.adminAuditLog.at(-1).action, "admin-user.archive");
});

test("remocao bloqueia a propria conta e preserva administrador efetivo", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const self = await json("/api/v1/admin/users/user-demo-admin", withCookie(cookie, adminJson("DELETE", {})));

  assert.equal(self.response.status, 409);
  assert.equal(env.__data.adminUsers.find((user) => user.id === "user-demo-admin").status, "active");
});

test("administrador mestre nao pode ser desativado, removido ou perder perfis e unidades", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env, AURORA_USER_ID);

  const disabled = await json("/api/v1/admin/users/user-demo-admin/disable", withCookie(cookie, adminJson("POST", {})));
  const removed = await json("/api/v1/admin/users/user-demo-admin", withCookie(cookie, adminJson("DELETE", {})));
  const reassigned = await json(
    "/api/v1/admin/users/user-demo-admin",
    withCookie(cookie, adminJson("PATCH", {
      display_name: "Administrador mestre",
      email: "admin-demo@example.invalid",
      role_ids: [],
      hotel_ids: ["aurora-demo"],
    })),
  );

  assert.equal(disabled.response.status, 409);
  assert.equal(removed.response.status, 409);
  assert.equal(reassigned.response.status, 409);
  assert.equal(env.__data.adminUsers.find((user) => user.user_number === 1).status, "active");
  assert.deepEqual(
    env.__data.adminUserRoles.filter((entry) => entry.user_id === "user-demo-admin").map((entry) => entry.role_id).sort(),
    ["role-demo-manager", "role-erp-master"],
  );
});

test("administrador mestre recebe todas as unidades e permissoes independentemente dos vinculos", async () => {
  const { json, env } = createWorkerTestContext();
  env.__data.adminUserRoles = env.__data.adminUserRoles.filter((entry) => entry.user_id !== "user-demo-admin");
  env.__data.adminHotelAccess = env.__data.adminHotelAccess.filter((entry) => entry.user_id !== "user-demo-admin");
  const cookie = await createSessionCookie(env);

  const { response, body } = await json("/api/v1/admin/session", withCookie(cookie));

  assert.equal(response.status, 200);
  assert.equal(body.data.user.number, 1);
  assert.equal(body.data.user.is_master, true);
  assert.deepEqual(
    body.data.hotels.map((hotel) => hotel.hotel_id).sort(),
    env.__data.hotels.filter((hotel) => hotel.status === "active" && hotel.archived_at == null).map((hotel) => hotel.id).sort(),
  );
  assert.deepEqual(
    body.data.permissions.sort(),
    env.__data.adminPermissions.map((permission) => permission.permission_key).sort(),
  );
});

test("perfis e permissoes sao listados com rotulos humanos", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const roles = await json("/api/v1/admin/roles", withCookie(cookie));
  const permissions = await json("/api/v1/admin/permissions", withCookie(cookie));

  assert.equal(roles.response.status, 200);
  assert.equal(permissions.response.status, 200);
  const managerRole = roles.body.data.roles.find((role) => role.role_key === "demo-manager");
  assert.ok(managerRole.permissions.some((permission) => permission.permission_key === "admin.users.read"));
  assert.ok(permissions.body.data.permissions.some((permission) => permission.label === "Ver usuários"));
});

test("perfil sem usuarios pode ser removido, mas perfil protegido ou em uso nao", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  await json(
    "/api/v1/admin/roles",
    withCookie(cookie, adminJson("POST", { role_key: "perfil-removivel", name: "Perfil removivel", description: "Teste ficticio" })),
  );
  const role = env.__data.adminRoles.find((entry) => entry.role_key === "perfil-removivel");

  const removed = await json(`/api/v1/admin/roles/${role.id}`, withCookie(cookie, adminJson("DELETE", {})));
  const protectedRole = await json("/api/v1/admin/roles/role-demo-manager", withCookie(cookie, adminJson("DELETE", {})));

  env.__data.adminRoles.push({ id: "role-em-uso", role_key: "perfil-em-uso", name: "Perfil em uso" });
  env.__data.adminUserRoles.push({ user_id: "user-aurora-admin", role_id: "role-em-uso" });
  const inUse = await json("/api/v1/admin/roles/role-em-uso", withCookie(cookie, adminJson("DELETE", {})));

  assert.equal(removed.response.status, 200);
  assert.equal(env.__data.adminRoles.some((entry) => entry.id === role.id), false);
  assert.equal(protectedRole.response.status, 409);
  assert.equal(inUse.response.status, 409);
  assert.ok(env.__data.adminRoles.some((entry) => entry.id === "role-em-uso"));
});

test("perfil associado ao administrador mestre nao pode perder permissoes", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const result = await json(
    "/api/v1/admin/roles/role-demo-manager/permissions",
    withCookie(cookie, adminJson("PATCH", { permission_keys: [] })),
  );

  assert.equal(result.response.status, 409);
  assert.equal(env.__data.adminRolePermissions.some((entry) => entry.role_id === "role-demo-manager"), true);
});

test("alteracao da propria senha valida politica, troca hash e revoga sessao atual", async () => {
  const { json, env } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);

  const weak = await json(
    "/api/v1/admin/me/password",
    withCookie(cookie, adminJson("POST", {
      current_password: "DemoAdmin!2026",
      new_password: "curta",
      confirm_password: "curta",
    })),
  );
  const ok = await json(
    "/api/v1/admin/me/password",
    withCookie(cookie, adminJson("POST", {
      current_password: "DemoAdmin!2026",
      new_password: "SenhaNovaDemo2026",
      confirm_password: "SenhaNovaDemo2026",
    })),
  );

  assert.equal(weak.response.status, 400);
  assert.equal(ok.response.status, 200);
  assert.equal(ok.body.data.login_required, true);
  assert.ok(env.__data.adminUsers[0].password_changed_at);
  assert.equal(env.__data.adminUsers[0].force_password_change, 0);
  assert.ok(env.__data.adminSessions[0].revoked_at);
  assert.doesNotMatch(JSON.stringify(ok.body), /password_hash|pbkdf|token/i);
});

test("rotas visuais de usuarios, perfis e minha conta entregam shell administrativo", async () => {
  const { fetch } = createWorkerTestContext();
  for (const path of ["/admin/usuarios/", "/admin/perfis/", "/admin/minha-conta/"]) {
    const response = await fetch(path);
    const html = await response.text();
    assert.equal(response.status, 200, path);
    assert.match(html, /usersManager|rolesManager|accountManager|loginForm/, path);
    assert.doesNotMatch(html, /Not Found|"error"/, path);
  }
});

test("migration 0012 adiciona permissoes sem associar roles reais", () => {
  const source = fs.readFileSync("migrations/0012_admin_users_security.sql", "utf8");
  assert.match(source, /admin\.users\.read/);
  assert.match(source, /admin\.roles\.permissions/);
  assert.match(source, /session_type/);
  assert.doesNotMatch(source, /INSERT\s+OR\s+IGNORE\s+INTO\s+admin_role_permissions/i);
});

function adminJson(method, body) {
  return {
    method,
    headers: ADMIN_HEADERS,
    body: JSON.stringify(body),
  };
}
