export function createHotelContext({ session, preferences }) {
  const hotels = Array.isArray(session?.hotels) ? session.hotels : [];
  const preferred = hotels.find((hotel) => hotel.hotel_id === preferences.preferredHotelId);
  const current = preferred || hotels[0] || null;
  return { hotels, current };
}

export function renderHotelOptions(select, hotels, selectedHotelId) {
  select.innerHTML = hotels
    .map((hotel) => `<option value="${escapeAttr(hotel.hotel_id)}" ${hotel.hotel_id === selectedHotelId ? "selected" : ""}>${escapeHtml(hotel.short_name || hotel.name)}</option>`)
    .join("");
}

export function updateBranding({ hotel, branding = null, elements }) {
  const name = hotel?.short_name || hotel?.name || "Room Service";
  elements.brandName.textContent = name;
  elements.brandSubtitle.textContent = hotel?.name ? "ERP operacional" : "Unidade Fioreze";
  elements.seal.textContent = initials(name);
  const root = document.documentElement;
  if (branding?.primary_color) root.style.setProperty("--rs-accent", branding.primary_color);
  if (branding?.secondary_color) root.style.setProperty("--rs-accent-muted", branding.secondary_color);
}

function initials(value) {
  return String(value || "F")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
