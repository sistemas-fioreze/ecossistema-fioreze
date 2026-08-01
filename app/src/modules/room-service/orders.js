import { batch, first, statement } from "../../core/database.js";
import { badRequest, conflict, notFoundError, unprocessable } from "../../core/errors.js";
import { createPublicId, isValidIdempotencyKey } from "../../core/identifiers.js";
import { multiplyCents } from "../../core/money.js";
import { nowIso } from "../../core/time.js";
import { optionalString, readJson, requireArray, requirePositiveInteger, requireString } from "../../core/validation.js";
import { assertRoomServiceOpen } from "./service-hours.js";

const MODULE_KEY = "room-service";

export async function createRoomServiceOrder({ request, env, tenant }) {
  const idempotencyKey = request.headers.get("Idempotency-Key") || "";
  if (!isValidIdempotencyKey(idempotencyKey)) {
    throw badRequest("Idempotency-Key obrigatoria e invalida.", {
      expected: "8 a 128 caracteres alfanumericos, ponto, dois-pontos, underline ou hifen.",
    });
  }

  const existing = await findOrderByIdempotencyKey(env, tenant.hotel_id, idempotencyKey);
  if (existing) {
    return { ...existing, idempotent: true };
  }

  const serviceStatus = assertRoomServiceOpen({ request, env, tenant, moduleKey: MODULE_KEY });
  if (!serviceStatus.open) {
    throw unprocessable("Room Service fechado no momento.", {
      next_opening: serviceStatus.next_opening,
    });
  }

  const payload = await readJson(request);
  const guestName = requireString(payload.guest_name, "guest_name", { max: 120 });
  const roomCode = requireString(payload.room_code, "room_code", { max: 24 });
  const notes = optionalString(payload.notes, "notes", { max: 500 });
  const origin = optionalString(payload.origin, "origin", { max: 40 }) || "public-web";
  const items = requireArray(payload.items, "items", { min: 1, max: 30 }).map((item, index) => ({
    catalog_item_id: requireString(item.catalog_item_id, `items[${index}].catalog_item_id`, { max: 80 }),
    quantity: requirePositiveInteger(item.quantity, `items[${index}].quantity`, { min: 1, max: 20 }),
    note: optionalString(item.note, `items[${index}].note`, { max: 180 }),
    client_unit_price_cents: Number.isInteger(item.unit_price_cents) ? item.unit_price_cents : null,
    client_total_cents: Number.isInteger(item.total_cents) ? item.total_cents : null,
  }));

  const room = await first(
    env,
    `SELECT id, code
       FROM rooms
      WHERE hotel_id = ? AND code = ? AND status = 'active'
      LIMIT 1`,
    [tenant.hotel_id, roomCode],
  );
  if (!room) throw unprocessable("Acomodacao indisponivel para este hotel.");

  const itemSnapshots = [];
  let subtotalCents = 0;
  for (const item of items) {
    const row = await first(
      env,
      `SELECT ci.id, ci.hotel_id, ci.module_key, ci.catalog_id, ci.name, ci.description,
              ci.price_cents, ci.currency, ci.status, ca.is_available
         FROM catalog_items ci
         JOIN catalogs c ON c.id = ci.catalog_id
         LEFT JOIN catalog_item_availability ca
                ON ca.catalog_item_id = ci.id AND ca.hotel_id = ci.hotel_id
        WHERE ci.id = ?
          AND ci.hotel_id = ?
          AND ci.module_key = ?
          AND c.module_key = ?
        LIMIT 1`,
      [item.catalog_item_id, tenant.hotel_id, MODULE_KEY, MODULE_KEY],
    );

    if (!row) throw notFoundError("Produto inexistente para este hotel e modulo.");
    if (row.status !== "active") throw unprocessable("Produto arquivado ou inativo.");
    if (row.is_available === 0) throw unprocessable("Produto indisponivel.");

    const lineTotalCents = multiplyCents(row.price_cents, item.quantity);
    if (item.client_unit_price_cents != null && item.client_unit_price_cents !== row.price_cents) {
      throw conflict("Preco enviado pelo navegador diverge do banco.");
    }
    if (item.client_total_cents != null && item.client_total_cents !== lineTotalCents) {
      throw conflict("Total de item enviado pelo navegador diverge do banco.");
    }

    subtotalCents += lineTotalCents;
    itemSnapshots.push({
      catalog_item_id: row.id,
      name: row.name,
      description: row.description,
      unit_price_cents: row.price_cents,
      currency: row.currency,
      quantity: item.quantity,
      note: item.note,
      line_total_cents: lineTotalCents,
    });
  }

  if (Number.isInteger(payload.subtotal_cents) && payload.subtotal_cents !== subtotalCents) {
    throw conflict("Subtotal enviado pelo navegador diverge do banco.");
  }
  if (Number.isInteger(payload.total_cents) && payload.total_cents !== subtotalCents) {
    throw conflict("Total enviado pelo navegador diverge do banco.");
  }

  const orderId = createPublicId("ord");
  const orderPublicId = createPublicId("rs");
  const createdAt = nowIso();
  const currency = tenant.currency || "BRL";

  const statements = [
    statement(
      env,
      `INSERT INTO orders (
         id, public_id, hotel_id, module_key, origin, room_id, room_code,
         guest_name, notes, currency, subtotal_cents, discount_cents,
         total_cents, status, idempotency_key, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'received', ?, ?, ?)`,
      [
        orderId,
        orderPublicId,
        tenant.hotel_id,
        MODULE_KEY,
        origin,
        room.id,
        room.code,
        guestName,
        notes,
        currency,
        subtotalCents,
        subtotalCents,
        idempotencyKey,
        createdAt,
        createdAt,
      ],
    ),
    statement(
      env,
      `INSERT INTO order_status_history (
         id, order_id, hotel_id, module_key, status, note, created_at
       ) VALUES (?, ?, ?, ?, 'received', 'Pedido recebido localmente.', ?)`,
      [createPublicId("hist"), orderId, tenant.hotel_id, MODULE_KEY, createdAt],
    ),
  ];

  for (const item of itemSnapshots) {
    statements.push(
      statement(
        env,
        `INSERT INTO order_items (
           id, order_id, hotel_id, module_key, catalog_item_id,
           item_name_snapshot, item_description_snapshot, unit_price_cents,
           quantity, line_total_cents, selected_options_snapshot, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createPublicId("item"),
          orderId,
          tenant.hotel_id,
          MODULE_KEY,
          item.catalog_item_id,
          item.name,
          item.description,
          item.unit_price_cents,
          item.quantity,
          item.line_total_cents,
          item.note ? JSON.stringify({ note: item.note }) : null,
          createdAt,
        ],
      ),
    );
  }

  await batch(env, statements);

  return {
    id: orderId,
    public_id: orderPublicId,
    hotel_id: tenant.hotel_id,
    module_key: MODULE_KEY,
    status: "received",
    room_code: room.code,
    currency,
    subtotal_cents: subtotalCents,
    total_cents: subtotalCents,
    items: itemSnapshots.map((item) => ({
      catalog_item_id: item.catalog_item_id,
      name: item.name,
      quantity: item.quantity,
      note: item.note,
      unit_price_cents: item.unit_price_cents,
      line_total_cents: item.line_total_cents,
    })),
    impression: {
      enabled: false,
      queued: false,
    },
    created_at: createdAt,
    idempotent: false,
  };
}

async function findOrderByIdempotencyKey(env, hotelId, idempotencyKey) {
  return first(
    env,
    `SELECT id, public_id, hotel_id, module_key, status, room_code,
            currency, subtotal_cents, total_cents, created_at
       FROM orders
      WHERE hotel_id = ?
        AND module_key = ?
        AND idempotency_key = ?
      LIMIT 1`,
    [hotelId, MODULE_KEY, idempotencyKey],
  );
}
