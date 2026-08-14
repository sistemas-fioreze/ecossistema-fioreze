export const GUEST_PROFILE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function guestProfileStorageKey(hotelId) {
  const normalizedHotelId = normalizeValue(hotelId, 80);
  return normalizedHotelId ? `fioreze:room-service:guest-profile:${encodeURIComponent(normalizedHotelId)}` : "";
}

export function readGuestProfile({ hotelId, storage = browserStorage(), now = Date.now() }) {
  const key = guestProfileStorageKey(hotelId);
  if (!key || !storage) return null;
  try {
    const profile = JSON.parse(storage.getItem(key) || "null");
    if (!profile || profile.version !== 1 || profile.hotel_id !== normalizeValue(hotelId, 80)) return null;
    if (!Number.isFinite(profile.expires_at) || profile.expires_at <= now) {
      storage.removeItem(key);
      return null;
    }
    const guestName = normalizeValue(profile.guest_name, 120);
    const roomCode = normalizeValue(profile.room_code, 24);
    if (!guestName || !roomCode) return null;
    return {
      guest_name: guestName,
      guest_phone: normalizeValue(profile.guest_phone, 40),
      room_code: roomCode,
      expires_at: profile.expires_at,
    };
  } catch {
    return null;
  }
}

export function writeGuestProfile({ hotelId, profile, storage = browserStorage(), now = Date.now() }) {
  const normalizedHotelId = normalizeValue(hotelId, 80);
  const key = guestProfileStorageKey(normalizedHotelId);
  if (!key || !storage) return null;
  const value = {
    version: 1,
    hotel_id: normalizedHotelId,
    guest_name: normalizeValue(profile?.guest_name, 120),
    guest_phone: normalizeValue(profile?.guest_phone, 40),
    room_code: normalizeValue(profile?.room_code, 24),
    expires_at: now + GUEST_PROFILE_TTL_MS,
  };
  if (!value.guest_name || !value.room_code) return null;
  try {
    storage.setItem(key, JSON.stringify(value));
    return value;
  } catch {
    return null;
  }
}

export function clearGuestProfile({ hotelId, storage = browserStorage() }) {
  const key = guestProfileStorageKey(hotelId);
  if (!key || !storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Browsers may deny storage in private or embedded contexts.
  }
}

function normalizeValue(value, max) {
  return String(value || "").trim().slice(0, max);
}

function browserStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}
