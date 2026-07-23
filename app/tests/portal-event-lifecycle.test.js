import assert from "node:assert/strict";
import test from "node:test";

import {
  archiveExpiredPortalEvents,
  resolvePortalEventStatus,
} from "../src/services/portal-event-lifecycle.js";

const NOW = "2026-07-23T15:00:00.000Z";

test("status publicado encerrado e resolvido como arquivado", () => {
  assert.equal(resolvePortalEventStatus("published", "2026-07-23T14:59:59.000Z", NOW), "archived");
  assert.equal(resolvePortalEventStatus("published", "2026-07-23T15:00:00.000Z", NOW), "archived");
  assert.equal(resolvePortalEventStatus("published", "2026-07-23T15:00:01.000Z", NOW), "published");
  assert.equal(resolvePortalEventStatus("draft", "2026-07-23T14:00:00.000Z", NOW), "draft");
});

test("rotina automatica arquiva somente eventos publicados e encerrados", async () => {
  const events = [
    { id: "expired", status: "published", ends_at: "2026-07-23T14:59:59.000Z", updated_at: "" },
    { id: "future", status: "published", ends_at: "2026-07-23T15:00:01.000Z", updated_at: "" },
    { id: "draft", status: "draft", ends_at: "2026-07-23T14:00:00.000Z", updated_at: "" },
    { id: "open-ended", status: "published", ends_at: null, updated_at: "" },
  ];
  const env = {
    DB: {
      prepare(sql) {
        assert.match(sql, /UPDATE events/);
        return {
          bind(updatedAt, cutoff) {
            return {
              async run() {
                let changes = 0;
                for (const event of events) {
                  if (event.status === "published" && event.ends_at && event.ends_at <= cutoff) {
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
    { id: "expired", status: "archived" },
    { id: "future", status: "published" },
    { id: "draft", status: "draft" },
    { id: "open-ended", status: "published" },
  ]);
});
