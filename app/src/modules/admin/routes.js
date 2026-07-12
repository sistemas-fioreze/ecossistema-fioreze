import { requireAuthentication } from "../../middleware/authentication.js";
import { loginAdmin, logoutAdmin, toSessionPayload } from "../../services/admin-auth.js";
import {
  archiveAdminHotelNavigation,
  createAdminHotel,
  createAdminHotelNavigation,
  getAdminHotel,
  getAdminHotelBranding,
  getAdminHotelSettings,
  getAdminHotelEmbed,
  listAdminHotelModules,
  listAdminHotelNavigation,
  listAdminHotels,
  updateAdminHotel,
  updateAdminHotelBranding,
  updateAdminHotelModules,
  updateAdminHotelNavigation,
  updateAdminHotelSettings,
  updateAdminHotelEmbed,
} from "./hotels.js";
import { archiveAdminMedia, getAdminMedia, listAdminMedia, updateAdminMedia, uploadAdminMedia } from "./media.js";
import { getAdminOrder, listAdminHotels as listOrderHotels, listAdminOrders, updateAdminOrderStatus } from "./orders.js";
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
    try {
      return ok(await listAdminHotels({ env, session, url: new URL(request.url) }));
    } catch (error) {
      if (error?.code !== "unauthorized") throw error;
      return ok(await listOrderHotels({ env, session }));
    }
  });

  router.post("/api/v1/admin/hotels", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await createAdminHotel({ request, env, session }));
  });

  router.get("/api/v1/admin/hotels/:id", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await getAdminHotel({ env, session, hotelId: params.id }));
  });

  router.patch("/api/v1/admin/hotels/:id", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await updateAdminHotel({ request, env, session, hotelId: params.id }));
  });

  router.get("/api/v1/admin/hotels/:id/branding", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await getAdminHotelBranding({ env, session, hotelId: params.id }));
  });

  router.patch("/api/v1/admin/hotels/:id/branding", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await updateAdminHotelBranding({ request, env, session, hotelId: params.id }));
  });

  router.get("/api/v1/admin/hotels/:id/settings", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await getAdminHotelSettings({ env, session, hotelId: params.id }));
  });

  router.patch("/api/v1/admin/hotels/:id/settings", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await updateAdminHotelSettings({ request, env, session, hotelId: params.id }));
  });

  router.get("/api/v1/admin/hotels/:id/embed", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await getAdminHotelEmbed({ env, session, hotelId: params.id }));
  });

  router.patch("/api/v1/admin/hotels/:id/embed", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await updateAdminHotelEmbed({ request, env, session, hotelId: params.id }));
  });

  router.get("/api/v1/admin/hotels/:id/modules", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await listAdminHotelModules({ env, session, hotelId: params.id }));
  });

  router.patch("/api/v1/admin/hotels/:id/modules", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await updateAdminHotelModules({ request, env, session, hotelId: params.id }));
  });

  router.get("/api/v1/admin/hotels/:id/navigation", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await listAdminHotelNavigation({ env, session, hotelId: params.id }));
  });

  router.post("/api/v1/admin/hotels/:id/navigation", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await createAdminHotelNavigation({ request, env, session, hotelId: params.id }));
  });

  router.patch("/api/v1/admin/hotels/:id/navigation/:item_id", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(
      await updateAdminHotelNavigation({
        request,
        env,
        session,
        hotelId: params.id,
        itemId: params.item_id,
      }),
    );
  });

  router.delete("/api/v1/admin/hotels/:id/navigation/:item_id", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(
      await archiveAdminHotelNavigation({
        request,
        env,
        session,
        hotelId: params.id,
        itemId: params.item_id,
      }),
    );
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
