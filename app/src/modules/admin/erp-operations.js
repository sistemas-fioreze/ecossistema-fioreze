import { all, batch, first, statement } from "../../core/database.js";
import { badRequest, conflict, notFoundError } from "../../core/errors.js";
import { createPublicId } from "../../core/identifiers.js";
import { requestNow } from "../../core/time.js";
import { optionalString, readJson, requireArray, requireString } from "../../core/validation.js";
import { evaluateServiceHours } from "../room-service/service-hours.js";
import {
  assertAdminMutationAllowed,
  requireAdminHotelAccess,
  requirePermission,
} from "../../services/admin-auth.js";
import { erpActorIds } from "../../services/erp-auth.js";

export const ERP_SETTINGS_PERMISSION = "room-service.settings.manage";
export const OPERATION_MODE_KEY = "room-service.operation_mode";
const MODULE_KEY = "room-service";
const OPERATION_MODES = new Set(["automatic", "forced_open", "forced_closed"]);
const ROOM_STATUSES = new Set(["active", "inactive", "archived"]);
const CLOCK_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export async function loadRoomServiceOperationState({ env, hotelId, timezone, now = new Date() }) {
  const [hours, setting] = await Promise.all([
    listActiveServiceHours(env, hotelId),
    first(
      env,
      `SELECT setting_value
         FROM hotel_settings
        WHERE hotel_id = ?
          AND setting_key = ?
        LIMIT 1`,
      [hotelId, OPERATION_MODE_KEY],
    ),
  ]);
  const mode = normalizeStoredMode(setting?.setting_value);
  const schedule = evaluateServiceHours({ serviceHours: hours, timezone, now });
  return {
    mode,
    source: mode === "automatic" ? "schedule" : "manual_override",
    open: mode === "forced_open" || (mode === "automatic" && schedule.open),
    schedule_open: schedule.open,
    active_slot: schedule.active_slot,
    next_opening: schedule.next_opening,
    local: schedule.local,
    service_hours: hours,
  };
}

export async function getRoomServiceOperations({ env, session, url }) {
  requirePermission(session, ERP_SETTINGS_PERMISSION);
  const hotelId = requestedHotel(session, url.searchParams.get("hotel_id"));
  const hotel = session.hotels.find((entry) => entry.hotel_id === hotelId);
  const [operation, rooms] = await Promise.all([
    loadRoomServiceOperationState({ env, hotelId, timezone: hotel?.timezone || "America/Sao_Paulo" }),
    listRooms(env, hotelId),
  ]);
  return { hotel_id: hotelId, module_key: MODULE_KEY, operation, rooms };
}

export async function setRoomServiceOperationMode({ request, env, session }) {
  requirePermission(session, ERP_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const mode = requireString(payload.mode, "mode", { max: 30 });
  if (!OPERATION_MODES.has(mode)) throw badRequest("Modo de funcionamento invalido.");
  const note = optionalString(payload.note, "note", { max: 300 }) || null;
  const now = requestNow({ request, env });
  const actor = erpActorIds(session);
  await batch(env, [
    statement(
      env,
      `INSERT INTO hotel_settings (
         id, hotel_id, setting_key, setting_value, value_type, is_public, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'string', 1, ?, ?)
       ON CONFLICT(hotel_id, setting_key) DO UPDATE SET
         setting_value = excluded.setting_value,
         value_type = 'string',
         is_public = 1,
         updated_at = excluded.updated_at`,
      [createPublicId("setting"), hotelId, OPERATION_MODE_KEY, mode, now, now],
    ),
    auditStatement(env, actor, {
      hotelId,
      action: "room-service.operation_mode.updated",
      entityType: "hotel_setting",
      entityId: OPERATION_MODE_KEY,
      metadata: { mode, note },
      createdAt: now,
    }),
  ]);
  const hotel = session.hotels.find((entry) => entry.hotel_id === hotelId);
  return {
    hotel_id: hotelId,
    operation: await loadRoomServiceOperationState({
      env,
      hotelId,
      timezone: hotel?.timezone || "America/Sao_Paulo",
      now: new Date(now),
    }),
  };
}

export async function updateRoomServiceSchedule({ request, env, session }) {
  requirePermission(session, ERP_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const days = normalizeSchedule(payload.days);
  const now = requestNow({ request, env });
  const actor = erpActorIds(session);
  const statements = days.map((day) =>
    statement(
      env,
      `INSERT INTO service_hours (
         id, hotel_id, module_key, day_of_week, opens_at, closes_at,
         is_closed, sort_order, valid_from, valid_until, status,
         created_at, updated_at, archived_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, 'active', ?, ?, NULL)
       ON CONFLICT(hotel_id, module_key, day_of_week, sort_order) DO UPDATE SET
         opens_at = excluded.opens_at,
         closes_at = excluded.closes_at,
         is_closed = excluded.is_closed,
         valid_from = NULL,
         valid_until = NULL,
         status = 'active',
         updated_at = excluded.updated_at,
         archived_at = NULL`,
      [
        createPublicId("hours"),
        hotelId,
        MODULE_KEY,
        day.day_of_week,
        day.opens_at,
        day.closes_at,
        day.is_closed ? 1 : 0,
        now,
        now,
      ],
    ),
  );
  statements.push(
    statement(
      env,
      `UPDATE service_hours
          SET status = 'archived', archived_at = ?, updated_at = ?
        WHERE hotel_id = ?
          AND module_key = ?
          AND sort_order <> 0
          AND status = 'active'`,
      [now, now, hotelId, MODULE_KEY],
    ),
    auditStatement(env, actor, {
      hotelId,
      action: "room-service.schedule.updated",
      entityType: "service_hours",
      entityId: hotelId,
      metadata: { days: days.map(({ day_of_week, opens_at, closes_at, is_closed }) => ({ day_of_week, opens_at, closes_at, is_closed })) },
      createdAt: now,
    }),
  );
  await batch(env, statements);
  return { hotel_id: hotelId, service_hours: await listActiveServiceHours(env, hotelId) };
}

export async function listRoomServiceRooms({ env, session, url }) {
  requirePermission(session, ERP_SETTINGS_PERMISSION);
  const hotelId = requestedHotel(session, url.searchParams.get("hotel_id"));
  return { hotel_id: hotelId, rooms: await listRooms(env, hotelId) };
}

export async function createRoomServiceRoom({ request, env, session }) {
  requirePermission(session, ERP_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const code = normalizeRoomCode(payload.code);
  const label = optionalString(payload.label, "label", { max: 120 }) || null;
  const roomType = optionalString(payload.room_type, "room_type", { max: 80 }) || null;
  const sortOrder = normalizeSortOrder(payload.sort_order, 100);
  const roomId = createPublicId("room");
  const now = requestNow({ request, env });
  try {
    await batch(env, [
      statement(
        env,
        `INSERT INTO rooms (
           id, hotel_id, code, label, room_type, status, sort_order, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
        [roomId, hotelId, code, label, roomType, sortOrder, now, now],
      ),
      auditStatement(env, erpActorIds(session), {
        hotelId,
        action: "room-service.room.created",
        entityType: "room",
        entityId: roomId,
        metadata: { code },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (/unique constraint failed.*rooms/i.test(String(error?.message || ""))) {
      throw conflict("Ja existe uma acomodacao com esse codigo.");
    }
    throw error;
  }
  return { room: await requireRoom(env, hotelId, roomId) };
}

export async function updateRoomServiceRoom({ request, env, session, roomId }) {
  requirePermission(session, ERP_SETTINGS_PERMISSION);
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const hotelId = requestedHotel(session, payload.hotel_id);
  const current = await requireRoom(env, hotelId, roomId);
  const code = Object.hasOwn(payload, "code") ? normalizeRoomCode(payload.code) : current.code;
  const label = Object.hasOwn(payload, "label") ? optionalString(payload.label, "label", { max: 120 }) || null : current.label;
  const roomType = Object.hasOwn(payload, "room_type") ? optionalString(payload.room_type, "room_type", { max: 80 }) || null : current.room_type;
  const status = Object.hasOwn(payload, "status") ? requireString(payload.status, "status", { max: 20 }) : current.status;
  if (!ROOM_STATUSES.has(status)) throw badRequest("Status de acomodacao invalido.");
  const sortOrder = Object.hasOwn(payload, "sort_order") ? normalizeSortOrder(payload.sort_order, current.sort_order) : Number(current.sort_order || 100);
  const now = requestNow({ request, env });
  try {
    await batch(env, [
      statement(
        env,
        `UPDATE rooms
            SET code = ?, label = ?, room_type = ?, status = ?, sort_order = ?, updated_at = ?
          WHERE id = ? AND hotel_id = ?`,
        [code, label, roomType, status, sortOrder, now, roomId, hotelId],
      ),
      auditStatement(env, erpActorIds(session), {
        hotelId,
        action: "room-service.room.updated",
        entityType: "room",
        entityId: roomId,
        metadata: { code, status },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    if (/unique constraint failed.*rooms/i.test(String(error?.message || ""))) {
      throw conflict("Ja existe uma acomodacao com esse codigo.");
    }
    throw error;
  }
  return { room: await requireRoom(env, hotelId, roomId) };
}

export function applyRoomServiceOperationMode(scheduleStatus, modeValue) {
  const mode = normalizeStoredMode(modeValue);
  return {
    ...scheduleStatus,
    mode,
    source: mode === "automatic" ? "schedule" : "manual_override",
    open: mode === "forced_open" || (mode === "automatic" && Boolean(scheduleStatus.open)),
  };
}

async function listActiveServiceHours(env, hotelId) {
  return all(
    env,
    `SELECT sh.id, sh.hotel_id, sh.module_key, sh.day_of_week, sh.opens_at, sh.closes_at,
            sh.is_closed, sh.sort_order, sh.valid_from, sh.valid_until, sh.status
       FROM service_hours sh
      WHERE sh.hotel_id = ?
        AND sh.module_key = ?
        AND sh.status = 'active'
        AND sh.archived_at IS NULL
      ORDER BY sh.day_of_week, sh.sort_order`,
    [hotelId, MODULE_KEY],
  );
}

async function listRooms(env, hotelId) {
  return all(
    env,
    `SELECT id, hotel_id, code, label, room_type, status, sort_order, created_at, updated_at
       FROM rooms
      WHERE hotel_id = ?
        AND status != 'archived'
      ORDER BY sort_order, code`,
    [hotelId],
  );
}

async function requireRoom(env, hotelId, roomId) {
  const room = await first(
    env,
    `SELECT id, hotel_id, code, label, room_type, status, sort_order, created_at, updated_at
       FROM rooms
      WHERE id = ? AND hotel_id = ?
      LIMIT 1`,
    [roomId, hotelId],
  );
  if (!room) throw notFoundError("Acomodacao nao encontrada.");
  return room;
}

function normalizeSchedule(value) {
  const days = requireArray(value, "days", { min: 7, max: 7 }).map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw badRequest(`days[${index}] invalido.`);
    const day = Number(entry.day_of_week);
    if (!Number.isInteger(day) || day < 0 || day > 6) throw badRequest(`days[${index}].day_of_week invalido.`);
    const isClosed = Boolean(entry.is_closed);
    if (isClosed) return { day_of_week: day, opens_at: null, closes_at: null, is_closed: true };
    const opensAt = requireString(entry.opens_at, `days[${index}].opens_at`, { max: 5 });
    const closesAt = requireString(entry.closes_at, `days[${index}].closes_at`, { max: 5 });
    if (!CLOCK_PATTERN.test(opensAt) || !CLOCK_PATTERN.test(closesAt)) throw badRequest("Horario deve usar HH:MM.");
    return { day_of_week: day, opens_at: opensAt, closes_at: closesAt, is_closed: false };
  });
  if (new Set(days.map((day) => day.day_of_week)).size !== 7) throw badRequest("Informe cada dia da semana uma unica vez.");
  return days.sort((a, b) => a.day_of_week - b.day_of_week);
}

function requestedHotel(session, value) {
  const hotelId = requireString(value, "hotel_id", { max: 80 });
  requireAdminHotelAccess(session, hotelId);
  return hotelId;
}

function normalizeStoredMode(value) {
  return OPERATION_MODES.has(value) ? value : "automatic";
}

function normalizeRoomCode(value) {
  return requireString(value, "code", { max: 24 }).toUpperCase();
}

function normalizeSortOrder(value, fallback) {
  if (value == null || value === "") return Number(fallback || 100);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100000) throw badRequest("Ordem invalida.");
  return parsed;
}

function auditStatement(env, actor, { hotelId, action, entityType, entityId, metadata, createdAt }) {
  return statement(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, actor_erp_user_id,
       action, entity_type, entity_id, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createPublicId("audit"),
      hotelId,
      MODULE_KEY,
      actor.adminUserId,
      actor.erpUserId,
      action,
      entityType,
      entityId,
      JSON.stringify(metadata || {}),
      createdAt,
    ],
  );
}
