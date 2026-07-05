import { run } from "../core/database.js";
import { createPublicId } from "../core/identifiers.js";
import { nowIso } from "../core/time.js";

export async function recordAudit(env, event) {
  return run(
    env,
    `INSERT INTO admin_audit_log (
       id, hotel_id, module_key, actor_user_id, action, entity_type,
       entity_id, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createPublicId("audit"),
      event.hotel_id || null,
      event.module_key || null,
      event.actor_user_id || null,
      event.action,
      event.entity_type || null,
      event.entity_id || null,
      event.metadata_json ? JSON.stringify(event.metadata_json) : null,
      nowIso(),
    ],
  );
}
