import { first, run } from "../../core/database.js";
import { badRequest } from "../../core/errors.js";
import { requestNow } from "../../core/time.js";
import { readJson, requireString } from "../../core/validation.js";
import { assertAdminMutationAllowed } from "../../services/admin-auth.js";

export const DEFAULT_ADMIN_PALETTE = "fioreze";
export const ADMIN_PALETTES = new Set([
  DEFAULT_ADMIN_PALETTE,
  "terracotta",
  "forest",
  "ocean",
  "graphite",
  "burgundy",
  "sage",
  "navy",
  "plum",
  "sunset",
]);

export async function getAdminPreferences({ env, session }) {
  const row = await first(
    env,
    `SELECT color_palette, created_at, updated_at
       FROM admin_user_preferences
      WHERE user_id = ?
      LIMIT 1`,
    [session.user.id],
  );
  return formatPreferences(row);
}

export async function updateAdminPreferences({ request, env, session }) {
  assertAdminMutationAllowed({ request });
  const payload = await readJson(request);
  const unknownFields = Object.keys(payload).filter((key) => key !== "color_palette");
  if (unknownFields.length) throw badRequest("Preferências não permitidas.", { fields: unknownFields });

  const colorPalette = requireString(payload.color_palette, "color_palette", { max: 40 });
  if (!ADMIN_PALETTES.has(colorPalette)) throw badRequest("Paleta administrativa inválida.");

  const now = requestNow({ request, env });
  await run(
    env,
    `INSERT INTO admin_user_preferences (user_id, color_palette, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       color_palette = excluded.color_palette,
       updated_at = excluded.updated_at`,
    [session.user.id, colorPalette, now, now],
  );

  return {
    color_palette: colorPalette,
    updated_at: now,
  };
}

function formatPreferences(row) {
  return {
    color_palette: row?.color_palette || DEFAULT_ADMIN_PALETTE,
    updated_at: row?.updated_at || null,
  };
}
