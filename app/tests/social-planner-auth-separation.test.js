import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

test("Social Planner possui identidades e sessoes separadas da Central", () => {
  const migration = fs.readFileSync("migrations/0061_social_planner_users.sql", "utf8");
  const seed = fs.readFileSync("seeds/dev.sql", "utf8");
  const normalized = migration.toLowerCase().replaceAll(/\s+/g, " ");
  assert.match(normalized, /create table if not exists social_planner_users/);
  assert.match(normalized, /create table if not exists social_planner_sessions/);
  assert.match(normalized, /admin_user_id text unique references admin_users\(id\)/);
  assert.match(normalized, /where user_number = 1/);
  assert.match(normalized, /responsible_planner_user_id text references social_planner_users\(id\)/);
  assert.match(normalized, /author_planner_user_id text references social_planner_users\(id\)/);
  assert.doesNotMatch(normalized, /insert or ignore into admin_user_roles/);
  assert.match(normalized, /delete from admin_user_roles/);
  assert.match(normalized, /role_key = 'marketing-planner-editor'/);
  assert.match(seed, /INSERT OR IGNORE INTO social_planner_users/);
  assert.doesNotMatch(seed, /permission_key IN \('social-planner\.read', 'social-planner\.write'\)/);
});

test("somente o mestre da Central atravessa para a sessao do Planner", async () => {
  const context = createWorkerTestContext();
  const ordinaryCookie = await createSessionCookie(context.env, "user-aurora-admin");
  const ordinary = await context.json("/api/v1/social-planner/session", withCookie(ordinaryCookie));
  assert.equal(ordinary.response.status, 401);

  const masterCookie = await createSessionCookie(context.env, "user-demo-admin");
  const master = await context.json("/api/v1/social-planner/session", withCookie(masterCookie));
  assert.equal(master.response.status, 200);
  assert.equal(master.body.data.auth_source, "admin-master");
  assert.equal(master.body.data.access_level, "admin");
  assert.deepEqual(master.body.data.permissions, [
    "social-planner.read",
    "social-planner.write",
    "social-planner.users.manage",
  ]);
});

test("cookie do Planner nao autentica rotas da Central", async () => {
  const context = createWorkerTestContext();
  const response = await context.json("/api/v1/admin/session", {
    headers: {
      cookie: "fioreze_social_planner_session=token-isolado",
      "x-fioreze-test-now": "2026-07-12T12:00:00.000Z",
    },
  });
  assert.equal(response.response.status, 401);
  assert.equal(response.body.error.code, "unauthorized");
});

test("frontend usa somente APIs e URLs proprias do Planner", () => {
  const app = fs.readFileSync("social-planner/app.ts", "utf8");
  const repository = fs.readFileSync("social-planner/repository.ts", "utf8");
  const shell = fs.readFileSync("public/admin/social-planner/index.html", "utf8");
  const central = fs.readFileSync("public/js/modules/admin/admin.js", "utf8");
  assert.match(repository, /const base = "\/api\/v1\/social-planner"/);
  assert.match(app, /\/api\/v1\/social-planner\/session/);
  assert.match(app, /`\/socialplanner\/\$\{state\.view\}/);
  assert.doesNotMatch(app, /fetch\("\/api\/v1\/admin\/session"/);
  assert.match(shell, /id="plannerLoginForm"/);
  assert.match(shell, /conta exclusiva do Planner/);
  assert.match(shell, /Usuário ou e-mail/);
  assert.match(shell, /name="remember_me"/);
  assert.match(shell, /Permanecer conectado/);
  const auth = fs.readFileSync("src/services/social-planner-auth.js", "utf8");
  assert.match(auth, /normalizeLoginIdentifier\(payload\.email\)/);
  assert.match(auth, /payload\.remember_me === true/);
  assert.match(auth, /REMEMBERED_SESSION_TTL_SECONDS = 60 \* 60 \* 24 \* 30/);
  assert.match(auth, /persistent \? `; Max-Age=\$\{maxAge\}` : ""/);
  assert.match(app, /remember_me: data\.get\("remember_me"\) === "on"/);
  assert.match(auth, /@hoteisfioreze\.com\.br/);
  assert.match(central, /if \(session\?\.user\?\.is_master\)/);
  assert.match(central, /href: "\/socialplanner\/overview"/);
  assert.doesNotMatch(central, /href: "\/admin\/social-planner\/overview"/);
});
