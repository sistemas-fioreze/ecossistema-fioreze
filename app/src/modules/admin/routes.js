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
import {
  archiveAdminShortLink,
  createAdminShortLink,
  getAdminShortLink,
  getAdminShortLinkAnalytics,
  listAdminShortLinks,
  updateAdminShortLink,
} from "./short-links.js";
import {
  changeOwnPassword,
  createAdminRole,
  createAdminUser,
  deleteOwnAvatar,
  getAdminMe,
  getAdminRole,
  getAdminUser,
  listAdminPermissions,
  listAdminRoles,
  listAdminUsers,
  resetAdminUserPassword,
  revokeAdminUserSessions,
  revokeOwnSessions,
  serveAdminUserAvatar,
  setAdminUserStatus,
  updateAdminRole,
  updateAdminRolePermissions,
  updateAdminUser,
  uploadOwnAvatar,
} from "./users.js";
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

  router.get("/api/v1/admin/me", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await getAdminMe({ env, session }));
  });

  router.post("/api/v1/admin/me/password", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    const result = await changeOwnPassword({ request, env, session });
    return ok(result.data, { headers: result.headers });
  });

  router.get("/api/v1/admin/me/avatar", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return serveAdminUserAvatar({ env, session, userId: session.user.id });
  });

  router.head("/api/v1/admin/me/avatar", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return serveAdminUserAvatar({ env, session, userId: session.user.id, head: true });
  });

  router.post("/api/v1/admin/me/avatar", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await uploadOwnAvatar({ request, env, session }));
  });

  router.delete("/api/v1/admin/me/avatar", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await deleteOwnAvatar({ request, env, session }));
  });

  router.post("/api/v1/admin/me/sessions/revoke", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    const result = await revokeOwnSessions({ request, env, session });
    return ok(result.data, { headers: result.headers });
  });

  router.get("/api/v1/admin/users", async ({ request, env, url }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await listAdminUsers({ env, session, url }));
  });

  router.post("/api/v1/admin/users", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await createAdminUser({ request, env, session }), { status: 201 });
  });

  router.get("/api/v1/admin/users/:id", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await getAdminUser({ env, session, userId: params.id }));
  });

  router.get("/api/v1/admin/users/:id/avatar", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return serveAdminUserAvatar({ env, session, userId: params.id });
  });

  router.head("/api/v1/admin/users/:id/avatar", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return serveAdminUserAvatar({ env, session, userId: params.id, head: true });
  });

  router.patch("/api/v1/admin/users/:id", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await updateAdminUser({ request, env, session, userId: params.id }));
  });

  router.post("/api/v1/admin/users/:id/disable", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await setAdminUserStatus({ request, env, session, userId: params.id, status: "disabled" }));
  });

  router.post("/api/v1/admin/users/:id/activate", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await setAdminUserStatus({ request, env, session, userId: params.id, status: "active" }));
  });

  router.post("/api/v1/admin/users/:id/password-reset", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await resetAdminUserPassword({ request, env, session, userId: params.id }));
  });

  router.post("/api/v1/admin/users/:id/sessions/revoke", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await revokeAdminUserSessions({ request, env, session, userId: params.id }));
  });

  router.get("/api/v1/admin/roles", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await listAdminRoles({ env, session }));
  });

  router.post("/api/v1/admin/roles", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await createAdminRole({ request, env, session }), { status: 201 });
  });

  router.get("/api/v1/admin/roles/:id", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await getAdminRole({ env, session, roleId: params.id }));
  });

  router.patch("/api/v1/admin/roles/:id", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await updateAdminRole({ request, env, session, roleId: params.id }));
  });

  router.patch("/api/v1/admin/roles/:id/permissions", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await updateAdminRolePermissions({ request, env, session, roleId: params.id }));
  });

  router.get("/api/v1/admin/permissions", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await listAdminPermissions({ env, session }));
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

  router.get("/api/v1/admin/short-links", async ({ request, env, url }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await listAdminShortLinks({ request, env, session, url }));
  });

  router.post("/api/v1/admin/short-links", async ({ request, env }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await createAdminShortLink({ request, env, session }));
  });

  router.get("/api/v1/admin/short-links/:id", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await getAdminShortLink({ request, env, session, linkId: params.id }));
  });

  router.patch("/api/v1/admin/short-links/:id", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await updateAdminShortLink({ request, env, session, linkId: params.id }));
  });

  router.delete("/api/v1/admin/short-links/:id", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await archiveAdminShortLink({ request, env, session, linkId: params.id }));
  });

  router.get("/api/v1/admin/short-links/:id/analytics", async ({ request, env, params }) => {
    const session = await requireAuthentication({ request, env });
    return ok(await getAdminShortLinkAnalytics({ request, env, session, linkId: params.id }));
  });

  router.all("/api/v1/admin/*", async ({ request, env }) => {
    await requireAuthentication({ request, env });
    throw notFoundError("Rota administrativa nao encontrada.");
  });
}
