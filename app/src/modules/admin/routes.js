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
  createRoomServiceErpOrder,
  getRoomServiceErpBilling,
  getRoomServiceErpContext,
  getRoomServiceErpDashboard,
  getRoomServiceErpOrder,
  listRoomServiceErpCatalog,
  listRoomServiceErpGuests,
  listRoomServiceErpOrders,
  updateRoomServiceErpOrderStatus,
} from "./room-service-erp.js";
import {
  createRoomServiceErpUser,
  listRoomServiceErpPermissionDefinitions,
  listRoomServiceErpUsers,
  resetRoomServiceErpUserPassword,
  updateRoomServiceErpUser,
} from "./erp-users.js";
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
import {
  getCurrentRoomServiceErpSession,
  listRoomServiceErpLoginHotels,
  loginRoomServiceErp,
  logoutRoomServiceErp,
  toRoomServiceErpSessionPayload,
} from "../../services/erp-auth.js";

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

  router.get("/api/v1/admin/room-service/login-context", async ({ env }) => {
    return ok(await listRoomServiceErpLoginHotels(env));
  });

  router.post("/api/v1/admin/room-service/login", async ({ request, env }) => {
    const { session, headers } = await loginRoomServiceErp({ request, env });
    return ok(toRoomServiceErpSessionPayload(session), { headers });
  });

  router.post("/api/v1/admin/room-service/logout", async ({ request, env }) => {
    const erpLogout = await logoutRoomServiceErp({ request, env });
    const adminLogout = await logoutAdmin({ request, env });
    const headers = new Headers();
    for (const source of [erpLogout.headers, adminLogout.headers]) {
      const cookie = source.get("set-cookie");
      if (cookie) headers.append("set-cookie", cookie);
    }
    return ok({ logged_out: true }, { headers });
  });

  router.get("/api/v1/admin/room-service/session", async ({ request, env }) => {
    const session = await getCurrentRoomServiceErpSession({ request, env });
    return ok(toRoomServiceErpSessionPayload(session));
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

  router.get("/api/v1/admin/room-service/context", async ({ request, env, url }) => {
    const session = await getCurrentRoomServiceErpSession({ request, env });
    return ok(await getRoomServiceErpContext({ env, session, url }));
  });

  router.get("/api/v1/admin/room-service/dashboard", async ({ request, env, url }) => {
    const session = await getCurrentRoomServiceErpSession({ request, env });
    return ok(await getRoomServiceErpDashboard({ env, session, url }));
  });

  router.get("/api/v1/admin/room-service/orders", async ({ request, env, url }) => {
    const session = await getCurrentRoomServiceErpSession({ request, env });
    return ok(await listRoomServiceErpOrders({ env, session, url }));
  });

  router.post("/api/v1/admin/room-service/orders", async ({ request, env }) => {
    const session = await getCurrentRoomServiceErpSession({ request, env });
    const order = await createRoomServiceErpOrder({ request, env, session });
    return ok(order, { status: order.idempotent ? 200 : 201 });
  });

  router.get("/api/v1/admin/room-service/orders/:id", async ({ request, env, params }) => {
    const session = await getCurrentRoomServiceErpSession({ request, env });
    return ok(await getRoomServiceErpOrder({ env, session, orderId: params.id }));
  });

  router.post("/api/v1/admin/room-service/orders/:id/status", async ({ request, env, params }) => {
    const session = await getCurrentRoomServiceErpSession({ request, env });
    return ok(await updateRoomServiceErpOrderStatus({ request, env, session, orderId: params.id }));
  });

  router.get("/api/v1/admin/room-service/guests", async ({ request, env, url }) => {
    const session = await getCurrentRoomServiceErpSession({ request, env });
    return ok(await listRoomServiceErpGuests({ env, session, url }));
  });

  router.get("/api/v1/admin/room-service/billing", async ({ request, env, url }) => {
    const session = await getCurrentRoomServiceErpSession({ request, env });
    return ok(await getRoomServiceErpBilling({ env, session, url }));
  });

  router.get("/api/v1/admin/room-service/catalog", async ({ request, env, url }) => {
    const session = await getCurrentRoomServiceErpSession({ request, env });
    return ok(await listRoomServiceErpCatalog({ env, session, url }));
  });

  router.get("/api/v1/admin/room-service/permissions", async ({ request, env }) => {
    const session = await getCurrentRoomServiceErpSession({ request, env });
    return ok(listRoomServiceErpPermissionDefinitions({ session }));
  });

  router.get("/api/v1/admin/room-service/users", async ({ request, env, url }) => {
    const session = await getCurrentRoomServiceErpSession({ request, env });
    return ok(await listRoomServiceErpUsers({ env, session, url }));
  });

  router.post("/api/v1/admin/room-service/users", async ({ request, env }) => {
    const session = await getCurrentRoomServiceErpSession({ request, env });
    return ok(await createRoomServiceErpUser({ request, env, session }), { status: 201 });
  });

  router.patch("/api/v1/admin/room-service/users/:id", async ({ request, env, params }) => {
    const session = await getCurrentRoomServiceErpSession({ request, env });
    return ok(await updateRoomServiceErpUser({ request, env, session, userId: params.id }));
  });

  router.post("/api/v1/admin/room-service/users/:id/password", async ({ request, env, params }) => {
    const session = await getCurrentRoomServiceErpSession({ request, env });
    return ok(await resetRoomServiceErpUserPassword({ request, env, session, userId: params.id }));
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
