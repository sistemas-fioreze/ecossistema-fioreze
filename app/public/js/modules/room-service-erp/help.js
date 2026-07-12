import { HELP_TOPICS } from "./static-config.js";

export function renderHelp(drawer, route) {
  const items = HELP_TOPICS[route] || [];
  drawer.innerHTML = `
    <strong>Ajuda contextual</strong>
    <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  `;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
