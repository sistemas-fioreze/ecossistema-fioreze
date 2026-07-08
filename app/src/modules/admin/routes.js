import { requireAuthentication } from "../../middleware/authentication.js";
import { loginAdmin, logoutAdmin, toSessionPayload } from "../../services/admin-auth.js";
import { archiveAdminMedia, getAdminMedia, listAdminMedia, updateAdminMedia, uploadAdminMedia } from "./media.js";
import { getAdminOrder, listAdminHotels, listAdminOrders, updateAdminOrderStatus } from "./orders.js";
import { ok } from "../../core/responses.js";
import { notFoundError } from "../../core/errors.js";

export function registerAdminRoutes(router) {
  router.post("/api/v1/admin/login", async ({ request, env }) => {
    const { session, headers } = await loginAdmin({ request, env });
    return ok(toSessionPayload(session), { headers });
  });

  router.post("/api/v1/admin/logout", async ({ request, env }) => {
    const { headers } = await logoutAdmin({ request, env });
    return ok({ logged_out: true }, { headers });
  });

  router.get("/api/v1/admin/session", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return ok(toSessionPayload(session));
  });

  router.get("/api/v1/admin/hotels", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await listAdminHotels({ env, session }));
  });

  router.get("/api/v1/admin/orders", async ({ request, env, url }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await listAdminOrders({ env, session, url }));
  });

  router.get("/api/v1/admin/orders/:id", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await getAdminOrder({ env, session, orderId: params.id }));
  });

  router.post("/api/v1/admin/orders/:id/status", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await updateAdminOrderStatus({ request, env, session, orderId: params.id }));
  });

  router.post("/api/v1/admin/media", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await uploadAdminMedia({ request, env, session }));
  });

  router.get("/api/v1/admin/media", async ({ request, env, url }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await listAdminMedia({ env, session, url }));
  });

  router.get("/api/v1/admin/media/:id", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await getAdminMedia({ env, session, assetId: params.id }));
  });

  router.patch("/api/v1/admin/media/:id", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await updateAdminMedia({ request, env, session, assetId: params.id }));
  });

  router.delete("/api/v1/admin/media/:id", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await archiveAdminMedia({ request, env, session, assetId: params.id }));
  });

  router.all("/api/v1/admin/*", async ({ request, env }) => {
    await requireAuthentication({ request, env });
    throw notFoundError("Rota administrativa nao encontrada.");
  });
}
