import { first, run } from "../core/database.js";
import { unauthorized } from "../core/errors.js";
import { requestNow } from "../core/time.js";

const TOKEN_BYTES = 32;

export function createPrintAgentToken() {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function createEnrollmentCode() {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const value = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
  return `${value.slice(0, 5)}-${value.slice(5)}`;
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function requirePrintAgent({ request, env }) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw unauthorized("Agente de impressao nao autenticado.");
  const tokenHash = await sha256Hex(match[1]);
  const device = await first(
    env,
    `SELECT pd.id, pd.hotel_id, pd.module_key, pd.name, pd.platform,
            pd.app_version, pd.printer_name, pd.template_id, pd.status,
            h.slug AS hotel_slug, h.name AS hotel_name, h.timezone, h.currency
       FROM printer_devices pd
       JOIN hotels h ON h.id = pd.hotel_id
      WHERE pd.token_hash = ?
        AND pd.status IN ('active', 'paused')
        AND h.status = 'active'
        AND h.archived_at IS NULL
      LIMIT 1`,
    [tokenHash],
  );
  if (!device) throw unauthorized("Agente de impressao nao autenticado.");
  const now = requestNow({ request, env });
  await run(
    env,
    `UPDATE printer_devices SET last_seen_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, device.id],
  );
  return device;
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
