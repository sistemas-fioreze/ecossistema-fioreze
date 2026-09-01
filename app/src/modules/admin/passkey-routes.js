import { ok } from "../../core/responses.js";
import { requireAuthentication } from "../../middleware/authentication.js";
import {
  beginAdminPasskeyLogin,
  beginOwnAdminPasskeyRegistration,
  deleteOwnAdminPasskey,
  finishAdminPasskeyLogin,
  finishOwnAdminPasskeyRegistration,
  listOwnAdminPasskeys,
} from "../../services/admin-passkeys.js";
import { toSessionPayload } from "../../services/admin-auth.js";

export function registerAdminPasskeyRoutes(router) {
  router.post("/api/v1/admin/passkeys/login/options", async ({ request, env }) => {
    return ok(await beginAdminPasskeyLogin({ request, env }));
  });

  router.post("/api/v1/admin/passkeys/login/verify", async ({ request, env }) => {
    const { session, headers } = await finishAdminPasskeyLogin({ request, env });
    return ok(toSessionPayload(session), { headers });
  });

  router.get("/api/v1/admin/me/passkeys", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await listOwnAdminPasskeys({ env, session }));
  });

  router.post("/api/v1/admin/me/passkeys/registration/options", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await beginOwnAdminPasskeyRegistration({ request, env, session }));
  });

  router.post("/api/v1/admin/me/passkeys/registration/verify", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await finishOwnAdminPasskeyRegistration({ request, env, session }), { status: 201 });
  });

  router.delete("/api/v1/admin/me/passkeys/:id", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await deleteOwnAdminPasskey({ request, env, session, passkeyId: params.id }));
  });
}
