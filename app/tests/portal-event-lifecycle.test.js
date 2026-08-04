import assert from "node:assert/strict";
import test from "node:test";

import {
  archiveExpiredPortalEvents,
  resolvePortalEventStatus,
} from "../src/services/portal-event-lifecycle.js";

const NOW = "2026-07-23T15:00:00.000Z";

test("status publicado e resolvido pelo término da programação e permanência", () => {
  assert.equal(resolvePortalEventStatus("published", "2026-07-23T14:59:59.000Z", false, NOW), "archived");
  assert.equal(resolvePortalEventStatus("published", "2026-07-23T15:00:00.000Z", false, NOW), "archived");
  assert.equal(resolvePortalEventStatus("published", "2026-07-23T15:00:01.000Z", false, NOW), "published");
  assert.equal(resolvePortalEventStatus("published", "2026-07-23T14:00:00.000Z", true, NOW), "published");
  assert.equal(resolvePortalEventStatus("draft", "2026-07-23T14:00:00.000Z", false, NOW), "draft");
});

test("rotina automática preserva recorrências até o término da última ocorrência", async () => {
  const events = [
    { id: "ended", status: "published", starts_at: "2026-07-20T14:00:00.000Z", ends_at: "2026-07-23T14:59:59.000Z", is_permanent: 0, updated_at: "" },
    { id: "recurring", status: "published", starts_at: "2026-07-20T14:00:00.000Z", ends_at: "2026-07-30T18:00:00.000Z", is_permanent: 0, updated_at: "" },
    { id: "future", status: "published", starts_at: "2026-07-23T15:00:01.000Z", ends_at: null, is_permanent: 0, updated_at: "" },
    { id: "draft", status: "draft", starts_at: "2026-07-23T14:00:00.000Z", ends_at: null, is_permanent: 0, updated_at: "" },
    { id: "permanent", status: "published", starts_at: "2026-07-23T14:00:00.000Z", ends_at: null, is_permanent: 1, updated_at: "" },
  ];
  const env = {
    DB: {
      prepare(sql) {
        assert.match(sql, /UPDATE events/);
        assert.match(sql, /COALESCE\(ends_at, starts_at\)/);
        return {
          bind(updatedAt, cutoff) {
            return {
              async run() {
                let changes = 0;
                for (const event of events) {
                  if (event.status === "published" && !event.is_permanent && (event.ends_at || event.starts_at) <= cutoff) {
                    event.status = "archived";
                    event.updated_at = updatedAt;
                    changes += 1;
                  }
                }
                return { success: true, meta: { changes } };
              },
            };
          },
        };
      },
    },
  };

  assert.equal(await archiveExpiredPortalEvents(env, { now: NOW }), 1);
  assert.deepEqual(events.map(({ id, status }) => ({ id, status })), [
    { id: "ended", status: "archived" },
    { id: "recurring", status: "published" },
    { id: "future", status: "published" },
    { id: "draft", status: "draft" },
    { id: "permanent", status: "published" },
  ]);
});
