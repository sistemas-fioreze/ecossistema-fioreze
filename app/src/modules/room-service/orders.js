import { batch, first, statement } from "../../core/database.js";
import { badRequest, conflict, notFoundError, unprocessable } from "../../core/errors.js";
import { createPublicId, isValidIdempotencyKey } from "../../core/identifiers.js";
import { multiplyCents } from "../../core/money.js";
import { nowIso } from "../../core/time.js";
import { optionalString, readJson, requireArray, requirePositiveInteger, requireString } from "../../core/validation.js";
import {
  assertRoomServiceOpen,
  evaluateServiceHours,
  getLocalDateKey,
  getRequestDate,
} from "./service-hours.js";
import { PrintProvider } from "../../services/print-provider.js";
import { parseCatalogOptions } from "./products.js";

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
    return { ...existing, status: publicOrderStatus(existing.status), idempotent: true };
  }

  const payload = await readJson(request);
  const preparation = validatePreparation({ request, env, tenant, payload });
  const notesEnabled = tenant.settings?.[`${MODULE_KEY}.order_notes_enabled`] !== false;
  const guestName = requireString(payload.guest_name, "guest_name", { max: 120 });
  const roomCode = requireString(payload.room_code, "room_code", { max: 24 });
  const notes = optionalString(payload.notes, "notes", { max: 500 });
  const orderNote = optionalString(payload.order_note, "order_note", { max: 500 });
  const origin = optionalString(payload.origin, "origin", { max: 40 }) || "public-web";
  const items = requireArray(payload.items, "items", { min: 1, max: 30 }).map((item, index) => ({
    catalog_item_id: requireString(item.catalog_item_id, `items[${index}].catalog_item_id`, { max: 80 }),
    quantity: requirePositiveInteger(item.quantity, `items[${index}].quantity`, { min: 1, max: 20 }),
    note: optionalString(item.note, `items[${index}].note`, { max: 180 }),
    selected_options: validateSelectedOptionsShape(item.selected_options, `items[${index}].selected_options`),
    client_unit_price_cents: Number.isInteger(item.unit_price_cents) ? item.unit_price_cents : null,
    client_total_cents: Number.isInteger(item.total_cents) ? item.total_cents : null,
  }));

  if (!notesEnabled && (orderNote || items.some((item) => item.note))) {
    throw unprocessable("Observacoes estao desativadas para esta unidade.");
  }

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
              ci.price_cents, ci.currency, ci.status, ci.metadata_json, ca.is_available
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

    const selectedOptions = validateCatalogSelections(
      parseCatalogOptions(row.metadata_json, row.name),
      item.selected_options,
    );

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
      selected_options: selectedOptions,
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
         total_cents, status, idempotency_key, created_at, updated_at,
         preparation_mode, scheduled_for
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'received', ?, ?, ?, ?, ?)`,
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
        preparation.mode,
        preparation.scheduled_for,
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
          buildSelectedOptionsSnapshot(item),
          createdAt,
        ],
      ),
    );
  }

  const impression = await new PrintProvider(env).prepareQueueStatement({
    hotelId: tenant.hotel_id,
    moduleKey: MODULE_KEY,
    orderId,
    createdAt,
  });
  if (impression.statement) statements.push(impression.statement);

  await batch(env, statements);

  return {
    id: orderId,
    public_id: orderPublicId,
    hotel_id: tenant.hotel_id,
    module_key: MODULE_KEY,
    status: "sent",
    preparation_mode: preparation.mode,
    scheduled_for: preparation.scheduled_for,
    room_code: room.code,
    currency,
    subtotal_cents: subtotalCents,
    total_cents: subtotalCents,
    items: itemSnapshots.map((item) => ({
      catalog_item_id: item.catalog_item_id,
      name: item.name,
      quantity: item.quantity,
      note: item.note,
      selected_options: item.selected_options,
      unit_price_cents: item.unit_price_cents,
      line_total_cents: item.line_total_cents,
    })),
    impression: {
      enabled: impression.enabled,
      queued: impression.queued,
    },
    created_at: createdAt,
    idempotent: false,
  };
}

function validateSelectedOptionsShape(value, label) {
  if (value == null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest(`${label} deve ser um objeto.`);
  }
  const entries = Object.entries(value);
  if (entries.length > 8) throw badRequest(`${label} excede o limite permitido.`);
  return Object.fromEntries(entries.map(([key, optionValue]) => [
    requireString(key, `${label}.chave`, { max: 40 }),
    requireString(optionValue, `${label}.${key}`, { max: 120 }),
  ]));
}

function validateCatalogSelections(definitions, selectedOptions) {
  const allowedKeys = new Set(definitions.map((definition) => definition.key));
  if (Object.keys(selectedOptions).some((key) => !allowedKeys.has(key))) {
    throw unprocessable("Opcao invalida para este item.");
  }
  const normalized = {};
  for (const definition of definitions) {
    const selected = selectedOptions[definition.key] || "";
    if (definition.required && !selected) throw unprocessable(`${definition.label} e obrigatoria.`);
    if (selected && !definition.values.includes(selected)) throw unprocessable("Opcao invalida para este item.");
    if (selected) normalized[definition.key] = selected;
  }
  return normalized;
}

function buildSelectedOptionsSnapshot(item) {
  const snapshot = {};
  if (item.note) snapshot.note = item.note;
  if (Object.keys(item.selected_options).length) snapshot.selections = item.selected_options;
  return Object.keys(snapshot).length ? JSON.stringify(snapshot) : null;
}

async function findOrderByIdempotencyKey(env, hotelId, idempotencyKey) {
  return first(
    env,
    `SELECT id, public_id, hotel_id, module_key, status, room_code,
            currency, subtotal_cents, total_cents, preparation_mode,
            scheduled_for, created_at
       FROM orders
      WHERE hotel_id = ?
        AND module_key = ?
        AND idempotency_key = ?
      LIMIT 1`,
    [hotelId, MODULE_KEY, idempotencyKey],
  );
}

export async function getRoomServiceOrderStatus({ request, env, tenant, publicId }) {
  const trackingKey = request.headers.get("X-Order-Tracking-Key") || "";
  if (!isValidIdempotencyKey(trackingKey)) throw notFoundError("Pedido nao encontrado.");
  const order = await first(
    env,
    `SELECT public_id, status, preparation_mode, scheduled_for, created_at, updated_at
       FROM orders
      WHERE hotel_id = ?
        AND module_key = ?
        AND public_id = ?
        AND idempotency_key = ?
      LIMIT 1`,
    [tenant.hotel_id, MODULE_KEY, publicId, trackingKey],
  );
  if (!order) throw notFoundError("Pedido nao encontrado.");
  return {
    public_id: order.public_id,
    status: publicOrderStatus(order.status),
    preparation_mode: order.preparation_mode || "now",
    scheduled_for: order.scheduled_for || null,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

function validatePreparation({ request, env, tenant, payload }) {
  const mode = String(payload.preparation_mode || "now").trim().toLowerCase();
  if (!new Set(["now", "scheduled"]).has(mode)) throw badRequest("preparation_mode invalido.");
  if (mode === "now") {
    const serviceStatus = assertRoomServiceOpen({ request, env, tenant, moduleKey: MODULE_KEY });
    if (!serviceStatus.open) {
      throw unprocessable("Room Service fechado no momento.", { next_opening: serviceStatus.next_opening });
    }
    return { mode, scheduled_for: null };
  }

  if (tenant.settings?.[`${MODULE_KEY}.order_scheduling_enabled`] !== true) {
    throw unprocessable("Agendamento de pedidos indisponivel para esta unidade.");
  }
  if ((tenant.settings?.[`${MODULE_KEY}.operation_mode`] || "automatic") !== "automatic") {
    throw unprocessable("Agendamento disponivel somente no modo automatico do Room Service.");
  }
  const rawScheduledFor = requireString(payload.scheduled_for, "scheduled_for", { max: 40 });
  const scheduledDate = new Date(rawScheduledFor);
  if (Number.isNaN(scheduledDate.getTime())) throw badRequest("scheduled_for deve ser uma data valida.");
  const now = getRequestDate(request, env);
  if (scheduledDate.getTime() <= now.getTime()) throw unprocessable("Escolha um horario futuro para hoje.");
  const timezone = tenant.timezone || "America/Sao_Paulo";
  if (getLocalDateKey(scheduledDate, timezone) !== getLocalDateKey(now, timezone)) {
    throw unprocessable("O pedido so pode ser agendado para o mesmo dia.");
  }
  const schedule = evaluateServiceHours({
    serviceHours: tenant.service_hours?.[MODULE_KEY] || [],
    timezone,
    now: scheduledDate,
  });
  if (!schedule.open) throw unprocessable("O horario escolhido esta fora do funcionamento do Room Service.");
  return { mode, scheduled_for: scheduledDate.toISOString() };
}

function publicOrderStatus(status) {
  if (["received", "accepted", "preparing"].includes(status)) return "sent";
  if (status === "ready") return "printed";
  if (status === "delivered") return "delivered";
  return status;
}
