import { ok } from "../../core/responses.js";
import { requireAuthentication } from "../../middleware/authentication.js";
import { toSessionPayload } from "../../services/admin-auth.js";
import { ensureAdminTotpSchema } from "../../services/admin-totp-schema.js";
import {
  beginOwnAdminTotpSetup,
  disableOwnAdminTotp,
  finishAdminTotpLogin,
  finishOwnAdminTotpSetup,
  getOwnAdminTotpStatus,
  regenerateOwnAdminTotpRecoveryCodes,
} from "../../services/admin-totp.js";

export function registerAdminTotpRoutes(router) {
  router.post("/api/v1/admin/login/totp", async ({ request, env }) => {
    await ensureAdminTotpSchema(env);
    const { session, headers } = await finishAdminTotpLogin({ request, env });
    return ok(toSessionPayload(session), { headers });
  });

  router.get("/api/v1/admin/me/totp", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    await ensureAdminTotpSchema(env);
    return ok(await getOwnAdminTotpStatus({ env, session }));
  });

  router.post("/api/v1/admin/me/totp/setup/options", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    await ensureAdminTotpSchema(env);
    return ok(await beginOwnAdminTotpSetup({ request, env, session }));
  });

  router.post("/api/v1/admin/me/totp/setup/verify", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    await ensureAdminTotpSchema(env);
    return ok(await finishOwnAdminTotpSetup({ request, env, session }), { status: 201 });
  });

  router.post("/api/v1/admin/me/totp/recovery-codes/regenerate", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    await ensureAdminTotpSchema(env);
    return ok(await regenerateOwnAdminTotpRecoveryCodes({ request, env, session }));
  });

  router.post("/api/v1/admin/me/totp/disable", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    await ensureAdminTotpSchema(env);
    return ok(await disableOwnAdminTotp({ request, env, session }));
  });
}
