import { first, statement } from "../core/database.js";
import { createPublicId } from "../core/identifiers.js";

export class PrintProvider {
  constructor(env) {
    this.env = env;
    this.enabled = String(env?.IMPRESSION_ENABLED || "false").toLowerCase() === "true";
  }

  async prepareQueueStatement({ hotelId, moduleKey, orderId, createdAt }) {
    if (!this.enabled) {
      return {
        enabled: false,
        queued: false,
        reason: "impression-disabled",
        statement: null,
      };
    }
    const config = await first(
      this.env,
      `SELECT hs.setting_value, pt.id AS template_id
         FROM hotel_settings hs
         LEFT JOIN printer_templates pt
           ON pt.hotel_id = hs.hotel_id AND pt.module_key = ?
          AND pt.is_default = 1 AND pt.status = 'active'
        WHERE hs.hotel_id = ? AND hs.setting_key = 'room-service.printing_enabled'
        LIMIT 1`,
      [moduleKey, hotelId],
    );
    if (!isTrue(config?.setting_value) || !config?.template_id) {
      return { enabled: true, queued: false, reason: "unit-printing-disabled", statement: null };
    }
    return {
      enabled: true,
      queued: true,
      reason: null,
      statement: statement(
        this.env,
        `INSERT OR IGNORE INTO print_events (
           id, hotel_id, module_key, order_id, template_id, status, attempts,
           requested_at, created_at, updated_at, request_key, job_kind
         ) VALUES (?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?, 'automatic')`,
        [createPublicId("print"), hotelId, moduleKey, orderId, config.template_id, createdAt, createdAt, createdAt, `automatic:${orderId}`],
      ),
    };
  }

  async enqueue(input) {
    const prepared = await this.prepareQueueStatement(input);
    if (prepared.statement) await prepared.statement.run();
    return { enabled: prepared.enabled, queued: prepared.queued, reason: prepared.reason };
  }
}

function isTrue(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}
