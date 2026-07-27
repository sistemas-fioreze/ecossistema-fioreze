import assert from "node:assert/strict";
import test from "node:test";

import {
  archiveExpiredPortalEvents,
  resolvePortalEventStatus,
} from "../src/services/portal-event-lifecycle.js";

const NOW = "2026-07-23T15:00:00.000Z";

test("status publicado e resolvido pela data inicial e permanencia", () => {
  assert.equal(resolvePortalEventStatus("published", "2026-07-23T14:59:59.000Z", false, NOW), "archived");
  assert.equal(resolvePortalEventStatus("published", "2026-07-23T15:00:00.000Z", false, NOW), "archived");
  assert.equal(resolvePortalEventStatus("published", "2026-07-23T15:00:01.000Z", false, NOW), "published");
  assert.equal(resolvePortalEventStatus("published", "2026-07-23T14:00:00.000Z", true, NOW), "published");
  assert.equal(resolvePortalEventStatus("draft", "2026-07-23T14:00:00.000Z", false, NOW), "draft");
});

test("rotina automatica arquiva somente eventos publicados, iniciados e nao permanentes", async () => {
  const events = [
    { id: "started", status: "published", starts_at: "2026-07-23T14:59:59.000Z", is_permanent: 0, updated_at: "" },
    { id: "future", status: "published", starts_at: "2026-07-23T15:00:01.000Z", is_permanent: 0, updated_at: "" },
    { id: "draft", status: "draft", starts_at: "2026-07-23T14:00:00.000Z", is_permanent: 0, updated_at: "" },
    { id: "permanent", status: "published", starts_at: "2026-07-23T14:00:00.000Z", is_permanent: 1, updated_at: "" },
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
                  if (event.status === "published" && !event.is_permanent && event.starts_at <= cutoff) {
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
    { id: "started", status: "archived" },
    { id: "future", status: "published" },
    { id: "draft", status: "draft" },
    { id: "permanent", status: "published" },
  ]);
});
