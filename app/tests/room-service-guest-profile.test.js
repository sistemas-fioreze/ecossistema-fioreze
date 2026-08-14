import assert from "node:assert/strict";
import test from "node:test";
import {
  GUEST_PROFILE_TTL_MS,
  clearGuestProfile,
  guestProfileStorageKey,
  readGuestProfile,
  writeGuestProfile,
} from "../public/js/modules/room-service/guest-profile.js";

test("perfil do hospede permanece isolado por hotel e sem dados do pedido", () => {
  const storage = memoryStorage();
  const now = Date.parse("2026-08-13T12:00:00.000Z");
  const stored = writeGuestProfile({
    hotelId: "muller-fioreze",
    storage,
    now,
    profile: {
      guest_name: "Hospede Ficticio",
      guest_phone: "(00) 90000-0000",
      room_code: "12",
      notes: "nao deve ser armazenado",
    },
  });

  assert.equal(stored.expires_at, now + GUEST_PROFILE_TTL_MS);
  assert.deepEqual(readGuestProfile({ hotelId: "muller-fioreze", storage, now }), {
    guest_name: "Hospede Ficticio",
    guest_phone: "(00) 90000-0000",
    room_code: "12",
    expires_at: now + GUEST_PROFILE_TTL_MS,
  });
  assert.equal(readGuestProfile({ hotelId: "fioreze-centro", storage, now }), null);
  assert.doesNotMatch(storage.getItem(guestProfileStorageKey("muller-fioreze")), /nao deve ser armazenado/);
});

test("perfil vencido e removido e pode ser esquecido manualmente", () => {
  const storage = memoryStorage();
  const now = Date.parse("2026-08-13T12:00:00.000Z");
  writeGuestProfile({
    hotelId: "muller-fioreze",
    storage,
    now,
    profile: { guest_name: "Hospede Ficticio", room_code: "12" },
  });

  assert.equal(readGuestProfile({ hotelId: "muller-fioreze", storage, now: now + GUEST_PROFILE_TTL_MS + 1 }), null);
  assert.equal(storage.getItem(guestProfileStorageKey("muller-fioreze")), null);

  writeGuestProfile({ hotelId: "muller-fioreze", storage, now, profile: { guest_name: "Outro", room_code: "14" } });
  clearGuestProfile({ hotelId: "muller-fioreze", storage });
  assert.equal(readGuestProfile({ hotelId: "muller-fioreze", storage, now }), null);
});

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}
