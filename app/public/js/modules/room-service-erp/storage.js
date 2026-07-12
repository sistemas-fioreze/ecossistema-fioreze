import { ERP_STORAGE_VERSION } from "./static-config.js";

const KEY = "fioreze.roomServiceErp.preferences";
const DEFAULTS = {
  version: ERP_STORAGE_VERSION,
  theme: "light",
  compact: false,
  preferredHotelId: "",
  route: "dashboard",
  scale: 1,
  sound: false,
};

export function readPreferences() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (parsed.version !== ERP_STORAGE_VERSION) return { ...DEFAULTS };
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePreferences(next) {
  const safe = {
    version: ERP_STORAGE_VERSION,
    theme: next.theme === "dark" ? "dark" : "light",
    compact: Boolean(next.compact),
    preferredHotelId: String(next.preferredHotelId || ""),
    route: String(next.route || "dashboard"),
    scale: Number(next.scale || 1),
    sound: Boolean(next.sound),
  };
  localStorage.setItem(KEY, JSON.stringify(safe));
  return safe;
}

export function clearIncompatibleCache() {
  const prefs = readPreferences();
  if (prefs.version !== ERP_STORAGE_VERSION) {
    localStorage.removeItem(KEY);
  }
}
