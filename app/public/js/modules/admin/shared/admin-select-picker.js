import "../admin-totp.js?v=20260903-4";
import { installAdminDownloads } from "./admin-downloads.js";

const installedRoots = new WeakSet();

export function installAdminSelectPicker(root = document) {
  if (!root?.addEventListener || installedRoots.has(root)) return;
  installedRoots.add(root);
  installAdminDownloads(root);
  root.addEventListener("pointerdown", tryOpenAdminSelectPicker, true);
}

export function tryOpenAdminSelectPicker(event) {
  if (
    event.defaultPrevented ||
    event.button > 0 ||
    event.isPrimary === false
  ) {
    return false;
  }

  const select = event.target?.closest?.("select");
  if (
    !select ||
    String(select.tagName || "").toUpperCase() !== "SELECT" ||
    select.disabled ||
    select.multiple ||
    Number(select.size || 0) > 1 ||
    typeof select.showPicker !== "function"
  ) {
    return false;
  }

  try {
    select.focus?.({ preventScroll: true });
    select.showPicker();
    event.preventDefault();
    return true;
  } catch {
    // Browsers without a usable picker keep their normal select behavior.
    return false;
  }
}
