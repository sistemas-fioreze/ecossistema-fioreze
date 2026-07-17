import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createWorkerTestContext, jsonPost } from "./helpers/worker.js";

const ADMIN_EMAIL = "admin-demo@example.invalid";
const ADMIN_PASSWORD = "DemoAdmin!2026";
const BASE_NOW = "2026-07-17T15:00:00.000Z";

test("configuracao publica do login nao expoe secrets", async () => {
  const context = turnstileContext(successfulChallenge());
  const { response, body } = await context.json("/api/v1/public/admin/login-config");

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(body.data, {
    TURNSTILE_ENABLED: true,
    TURNSTILE_SITE_KEY: "site-key-publica-de-teste",
  });
  assert.equal(JSON.stringify(body).includes("secret"), false);
});

test("login valido aceita Turnstile com action e hostname esperados", async () => {
  const context = turnstileContext(successfulChallenge());
  const { response, body } = await login(context, {
    password: ADMIN_PASSWORD,
    turnstile_token: "token-valido",
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.match(response.headers.get("set-cookie") || "", /HttpOnly/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(context.env.__data.adminSessions.length, 1);
});

test("backend usa Siteverify por POST com timeout cancelavel", async () => {
  let captured;
  const context = turnstileContext(async (url, init) => {
    captured = { url, init };
    return jsonResponse({ success: true, action: "admin_login", hostname: "local.test" });
  });
  const { response } = await login(context, { password: ADMIN_PASSWORD, turnstile_token: "token-post" });

  assert.equal(response.status, 200);
  assert.equal(captured.url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.signal instanceof AbortSignal, true);
  const body = new URLSearchParams(String(captured.init.body));
  assert.equal(body.get("response"), "token-post");
  assert.equal(body.get("remoteip"), "198.51.100.1");
  assert.equal(Boolean(body.get("secret")), true);
  assert.equal(Boolean(body.get("idempotency_key")), true);
});

test("login invalido e usuario inexistente retornam erro indistinguivel", async () => {
  const invalidContext = createWorkerTestContext();
  const unknownContext = createWorkerTestContext();
  const invalid = await login(invalidContext, { password: "senha-incorreta" });
  const unknown = await login(unknownContext, {
    email: "usuario-inexistente@example.invalid",
    password: "senha-incorreta",
  });

  assert.equal(invalid.response.status, 401);
  assert.equal(unknown.response.status, 401);
  assert.deepEqual(invalid.body.error, unknown.body.error);
  assert.equal(invalidContext.env.__data.adminSessions.length, 0);
  assert.equal(unknownContext.env.__data.adminSessions.length, 0);
});

test("Turnstile ausente e rejeitado sem chamar Siteverify", async () => {
  let calls = 0;
  const context = turnstileContext(async () => {
    calls += 1;
    return jsonResponse({ success: true, action: "admin_login", hostname: "local.test" });
  });
  const { response } = await login(context, { password: ADMIN_PASSWORD });

  assert.equal(response.status, 401);
  assert.equal(calls, 0);
  assert.equal(context.env.__data.adminSessions.length, 0);
});

test("Turnstile invalido e rejeitado", async () => {
  const context = turnstileContext(
    async () => jsonResponse({ success: false, "error-codes": ["invalid-input-response"] }),
  );
  const { response } = await login(context, { password: ADMIN_PASSWORD, turnstile_token: "token-invalido" });

  assert.equal(response.status, 401);
  assert.equal(context.env.__data.adminSessions.length, 0);
});

test("Turnstile expirado e rejeitado", async () => {
  const context = turnstileContext(
    async () => jsonResponse({ success: false, "error-codes": ["timeout-or-duplicate"] }),
  );
  const { response } = await login(context, { password: ADMIN_PASSWORD, turnstile_token: "token-expirado" });

  assert.equal(response.status, 401);
  assert.equal(context.env.__data.adminLoginSecurityEvents.at(-1).reason_code, "token_expired_or_reused");
});

test("Turnstile reutilizado e rejeitado na segunda tentativa", async () => {
  let used = false;
  const context = turnstileContext(async () => {
    if (used) return jsonResponse({ success: false, "error-codes": ["timeout-or-duplicate"] });
    used = true;
    return jsonResponse({ success: true, action: "admin_login", hostname: "local.test" });
  });

  const first = await login(context, { password: ADMIN_PASSWORD, turnstile_token: "token-unico" });
  const second = await login(context, { password: ADMIN_PASSWORD, turnstile_token: "token-unico" });
  assert.equal(first.response.status, 200);
  assert.equal(second.response.status, 401);
  assert.equal(context.env.__data.adminSessions.length, 1);
});

test("Turnstile rejeita action incorreta", async () => {
  const context = turnstileContext(
    async () => jsonResponse({ success: true, action: "outra_action", hostname: "local.test" }),
  );
  const { response } = await login(context, { password: ADMIN_PASSWORD, turnstile_token: "token-action" });
  assert.equal(response.status, 401);
});

test("Turnstile rejeita hostname nao autorizado", async () => {
  const context = turnstileContext(
    async () => jsonResponse({ success: true, action: "admin_login", hostname: "host-nao-autorizado.invalid" }),
  );
  const { response } = await login(context, { password: ADMIN_PASSWORD, turnstile_token: "token-host" });
  assert.equal(response.status, 401);
});

test("Turnstile falha fechado quando Siteverify fica indisponivel", async () => {
  const context = turnstileContext(async () => {
    throw new Error("network unavailable");
  });
  const { response, body } = await login(context, { password: ADMIN_PASSWORD, turnstile_token: "token-rede" });

  assert.equal(response.status, 503);
  assert.equal(body.error.code, "login_security_unavailable");
  assert.equal(context.env.__data.adminSessions.length, 0);
});

test("Turnstile falha fechado quando a secret nao esta configurada", async () => {
  const context = createWorkerTestContext({
    TURNSTILE_ENABLED: "true",
    TURNSTILE_SITE_KEY: "site-key-publica-de-teste",
    TURNSTILE_ALLOWED_HOSTNAMES: "local.test",
  });
  const { response } = await login(context, { password: ADMIN_PASSWORD, turnstile_token: "token-sem-secret" });

  assert.equal(response.status, 503);
  assert.equal(context.env.__data.adminSessions.length, 0);
});

test("rate limit falha fechado quando a chave HMAC nao esta configurada", async () => {
  const context = createWorkerTestContext({ LOGIN_RATE_LIMIT_KEY: "" });
  const { response, body } = await login(context, { password: ADMIN_PASSWORD });

  assert.equal(response.status, 503);
  assert.equal(body.error.code, "login_security_unavailable");
  assert.equal(context.env.__data.adminSessions.length, 0);
});

test("cinco falhas de desafio para o mesmo e-mail nao bloqueiam a conta", async () => {
  for (const challengeFailure of ["missing", "invalid"]) {
    const context = turnstileContext(async (_url, init) => {
      const token = new URLSearchParams(String(init.body)).get("response");
      if (token?.startsWith("token-invalido")) {
        return jsonResponse({ success: false, "error-codes": ["invalid-input-response"] });
      }
      return jsonResponse({ success: true, action: "admin_login", hostname: "local.test" });
    });
    const responses = [];

    for (let index = 0; index < 5; index += 1) {
      const payload =
        challengeFailure === "missing"
          ? { password: ADMIN_PASSWORD }
          : { password: ADMIN_PASSWORD, turnstile_token: `token-invalido-${index}` };
      responses.push(await login(context, payload, { ip: `198.51.100.${index + 60}` }));
    }

    assert.deepEqual(responses.map((entry) => entry.response.status), [401, 401, 401, 401, 401]);
    assert.equal(
      context.env.__data.adminLoginAttempts.some((entry) => entry.identifier_type === "account"),
      false,
    );

    const authenticated = await login(
      context,
      { password: ADMIN_PASSWORD, turnstile_token: `token-valido-${challengeFailure}` },
      { ip: "198.51.100.99" },
    );
    assert.equal(authenticated.response.status, 200);
  }
});

test("falhas de desafio bloqueiam somente o IP no limite definido", async () => {
  const context = turnstileContext(
    async () => jsonResponse({ success: false, "error-codes": ["invalid-input-response"] }),
  );
  const responses = [];

  for (let index = 0; index < 10; index += 1) {
    responses.push(
      await login(
        context,
        { password: ADMIN_PASSWORD, turnstile_token: `token-invalido-${index}` },
        { ip: "203.0.113.77" },
      ),
    );
  }

  assert.deepEqual(responses.map((entry) => entry.response.status), [401, 401, 401, 401, 401, 401, 401, 401, 401, 429]);
  assert.equal(responses[9].response.headers.get("retry-after"), "60");
  const attempts = context.env.__data.adminLoginAttempts;
  assert.equal(attempts.some((entry) => entry.identifier_type === "account"), false);
  const ipAttempt = attempts.find((entry) => entry.identifier_type === "ip");
  assert.equal(ipAttempt.lock_level, 1);
  assert.equal(ipAttempt.failure_count, 0);
  assert.equal(context.env.__data.adminLoginSecurityEvents.length >= 10, true);
  const serializedEvents = JSON.stringify(context.env.__data.adminLoginSecurityEvents);
  assert.equal(serializedEvents.includes("203.0.113.77"), false);
  assert.equal(serializedEvents.includes(ADMIN_EMAIL), false);
});

test("cinco senhas incorretas apos Turnstile valido bloqueiam a conta", async () => {
  const context = turnstileContext(successfulChallenge());
  const responses = [];
  for (let index = 0; index < 5; index += 1) {
    responses.push(
      await login(
        context,
        { password: "senha-incorreta", turnstile_token: `token-valido-${index}` },
        { ip: `198.51.100.${index + 1}` },
      ),
    );
  }

  assert.deepEqual(responses.map((entry) => entry.response.status), [401, 401, 401, 401, 429]);
  assert.equal(responses[4].response.headers.get("retry-after"), "60");
  const accountAttempt = context.env.__data.adminLoginAttempts.find((entry) => entry.identifier_type === "account");
  assert.equal(accountAttempt.lock_level, 1);
  assert.equal(accountAttempt.failure_count, 0);
});

test("bloqueios sucessivos progridem por 1, 5, 15 e 60 minutos", async () => {
  const context = createWorkerTestContext();
  const expectedRetryAfter = [60, 300, 900, 3600];
  let now = Date.parse(BASE_NOW);

  for (let level = 0; level < expectedRetryAfter.length; level += 1) {
    let blocked;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      blocked = await login(
        context,
        { password: "senha-incorreta" },
        {
          ip: `198.51.${level + 1}.${attempt + 1}`,
          now: new Date(now).toISOString(),
        },
      );
    }
    assert.equal(blocked.response.status, 429);
    assert.equal(Number(blocked.response.headers.get("retry-after")), expectedRetryAfter[level]);
    now += expectedRetryAfter[level] * 1000 + 1000;
  }

  const accountAttempt = context.env.__data.adminLoginAttempts.find((entry) => entry.identifier_type === "account");
  assert.equal(accountAttempt.lock_level, 4);
});

test("bloqueio por IP agrega contas sem armazenar valores brutos", async () => {
  const context = createWorkerTestContext();
  const responses = [];
  for (let index = 0; index < 10; index += 1) {
    responses.push(
      await login(
        context,
        { email: `usuario-${index}@example.invalid`, password: "senha-incorreta" },
        { ip: "203.0.113.10" },
      ),
    );
  }

  assert.deepEqual(responses.map((entry) => entry.response.status), [401, 401, 401, 401, 401, 401, 401, 401, 401, 429]);
  const ipAttempt = context.env.__data.adminLoginAttempts.find((entry) => entry.identifier_type === "ip");
  assert.equal(ipAttempt.lock_level, 1);
  assert.match(ipAttempt.identifier_hash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(context.env.__data.adminLoginAttempts).includes("203.0.113.10"), false);
  assert.equal(JSON.stringify(context.env.__data.adminLoginAttempts).includes(ADMIN_EMAIL), false);
});

test("bloqueio e liberado apos o periodo e login valido limpa falhas da conta", async () => {
  const context = createWorkerTestContext();
  for (let index = 0; index < 5; index += 1) {
    await login(context, { password: "senha-incorreta" }, { ip: `198.51.100.${index + 20}` });
  }

  const unlocked = await login(
    context,
    { password: ADMIN_PASSWORD },
    { ip: "198.51.100.30", now: "2026-07-17T15:01:01.000Z" },
  );
  assert.equal(unlocked.response.status, 200);
  assert.equal(context.env.__data.adminLoginAttempts.some((entry) => entry.identifier_type === "account"), false);
});

test("IP bloqueado nao consome nova validacao Siteverify", async () => {
  let siteverifyCalls = 0;
  const context = turnstileContext(async () => {
    siteverifyCalls += 1;
    return jsonResponse({ success: true, action: "admin_login", hostname: "local.test" });
  });
  for (let index = 0; index < 10; index += 1) {
    await login(
      context,
      { email: `conta-${index}@example.invalid`, password: "senha-incorreta", turnstile_token: `token-${index}` },
      { ip: "203.0.113.44" },
    );
  }
  const blocked = await login(
    context,
    { email: "outra-conta@example.invalid", password: "senha-incorreta", turnstile_token: "token-extra" },
    { ip: "203.0.113.44" },
  );

  assert.equal(blocked.response.status, 429);
  assert.equal(siteverifyCalls, 10);
});

test("falhas concorrentes preservam um unico estado de bloqueio", async () => {
  const context = createWorkerTestContext();
  const responses = await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      login(context, { password: "senha-incorreta" }, { ip: `198.51.100.${index + 50}` }),
    ),
  );

  assert.deepEqual(responses.map((entry) => entry.response.status).sort(), [401, 401, 401, 401, 429]);
  const accountRows = context.env.__data.adminLoginAttempts.filter((entry) => entry.identifier_type === "account");
  assert.equal(accountRows.length, 1);
  assert.equal(accountRows[0].lock_level, 1);
});

test("respostas administrativas autenticadas usam no-store e APIs seguem protegidas", async () => {
  const context = createWorkerTestContext();
  const denied = await context.json("/api/v1/admin/session");
  assert.equal(denied.response.status, 401);
  assert.equal(denied.response.headers.get("cache-control"), "no-store");

  const authenticated = await login(context, { password: ADMIN_PASSWORD });
  const cookie = cookieFrom(authenticated.response);
  const session = await context.json("/api/v1/admin/session", { headers: { cookie } });
  const hotels = await context.json("/api/v1/admin/hotels", { headers: { cookie } });
  assert.equal(session.response.headers.get("cache-control"), "no-store");
  assert.equal(hotels.response.headers.get("cache-control"), "no-store");
});

test("shell administrativo nao usa sessionStorage e configura Turnstile explicitamente", () => {
  const source = readFileSync(new URL("../public/js/modules/admin/shared/admin-auth-view.js", import.meta.url), "utf8");
  const adminHtml = readFileSync(new URL("../public/admin/index.html", import.meta.url), "utf8");
  const portalsHtml = readFileSync(new URL("../public/admin/portais/index.html", import.meta.url), "utf8");

  assert.equal(source.includes("sessionStorage"), false);
  assert.equal(source.includes("ADMIN_SHELL_CACHE_KEY"), false);
  assert.match(source, /action: TURNSTILE_ACTION/);
  assert.match(source, /turnstile_token: turnstileToken/);
  assert.match(adminHtml, /id="loginTurnstile"/);
  assert.match(portalsHtml, /id="loginTurnstile"/);
});

test("Worker e Pages compartilham flags publicas sem versionar secrets", () => {
  const workerConfig = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  const pagesConfig = JSON.parse(readFileSync(new URL("../pages/wrangler.jsonc", import.meta.url), "utf8"));

  for (const config of [workerConfig, pagesConfig]) {
    assert.equal(config.vars.TURNSTILE_ENABLED, "false");
    assert.equal(Object.hasOwn(config.vars, "TURNSTILE_SECRET_KEY"), false);
    assert.equal(Object.hasOwn(config.vars, "LOGIN_RATE_LIMIT_KEY"), false);
  }
  assert.deepEqual(pagesConfig.vars, workerConfig.vars);
});

function turnstileContext(verifier) {
  return createWorkerTestContext({
    TURNSTILE_ENABLED: "true",
    TURNSTILE_SITE_KEY: "site-key-publica-de-teste",
    TURNSTILE_SECRET_KEY: "secret-local-de-teste",
    TURNSTILE_ALLOWED_HOSTNAMES: "local.test,fioreze-portais-pages-dev.pages.dev",
    __testTurnstileFetch: verifier,
  });
}

function successfulChallenge() {
  return async () => jsonResponse({ success: true, action: "admin_login", hostname: "local.test" });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function login(context, overrides = {}, requestOptions = {}) {
  return context.json(
    "/api/v1/admin/login",
    jsonPost(
      {
        email: overrides.email || ADMIN_EMAIL,
        password: overrides.password || ADMIN_PASSWORD,
        ...(Object.hasOwn(overrides, "turnstile_token") ? { turnstile_token: overrides.turnstile_token } : {}),
      },
      {
        "cf-connecting-ip": requestOptions.ip || "198.51.100.1",
        "x-fioreze-test-now": requestOptions.now || BASE_NOW,
      },
    ),
  );
}

function cookieFrom(response) {
  return (response.headers.get("set-cookie") || "").split(";")[0];
}
