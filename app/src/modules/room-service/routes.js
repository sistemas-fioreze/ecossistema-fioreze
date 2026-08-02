import { ok } from "../../core/responses.js";
import { resolveTenantBySlug } from "../../core/tenant.js";
import { requireEnabledModule } from "../../middleware/require-module.js";
import { groupProductsByCategory, listRoomServiceProducts } from "./products.js";
import { createRoomServiceOrder, getRoomServiceOrderStatus } from "./orders.js";
import { listPublicRoomServiceRooms } from "./rooms.js";

const MODULE_KEY = "room-service";

export function registerRoomServiceRoutes(router) {
  router.get("/api/v1/public/hotels/:hotel_slug/room-service/products", async ({ env, params }) => {
    const tenant = await resolveTenantBySlug(env, params.hotel_slug);
    await requireEnabledModule(env, tenant.hotel_id, MODULE_KEY);
    const rows = await listRoomServiceProducts(env, tenant.hotel_id);
    return ok({
      hotel_id: tenant.hotel_id,
      module_key: MODULE_KEY,
      categories: groupProductsByCategory(rows),
    });
  });

  router.get("/api/v1/public/hotels/:hotel_slug/room-service/rooms", async ({ env, params }) => {
    const tenant = await resolveTenantBySlug(env, params.hotel_slug);
    await requireEnabledModule(env, tenant.hotel_id, MODULE_KEY);
    return ok({
      hotel_id: tenant.hotel_id,
      module_key: MODULE_KEY,
      rooms: await listPublicRoomServiceRooms(env, tenant.hotel_id),
    });
  });

  router.post("/api/v1/public/hotels/:hotel_slug/room-service/orders", async ({ request, env, params }) => {
    const tenant = await resolveTenantBySlug(env, params.hotel_slug);
    await requireEnabledModule(env, tenant.hotel_id, MODULE_KEY);
    const order = await createRoomServiceOrder({ request, env, tenant });
    return ok(order, { status: order.idempotent ? 200 : 201 });
  });

  router.get("/api/v1/public/hotels/:hotel_slug/room-service/orders/:public_id/status", async ({ request, env, params }) => {
    const tenant = await resolveTenantBySlug(env, params.hotel_slug);
    await requireEnabledModule(env, tenant.hotel_id, MODULE_KEY);
    return ok(await getRoomServiceOrderStatus({ request, env, tenant, publicId: params.public_id }));
  });
}
