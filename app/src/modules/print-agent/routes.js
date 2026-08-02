import { ok } from "../../core/responses.js";
import {
  claimPrintJob,
  completePrintJob,
  enrollPrintAgent,
  failPrintJob,
  heartbeatPrintAgent,
  listPrintAgentEnrollmentHotels,
} from "./service.js";

export function registerPrintAgentRoutes(router) {
  router.get("/api/v1/print-agent/enrollment/hotels", async ({ env }) => ok(await listPrintAgentEnrollmentHotels(env)));
  router.post("/api/v1/print-agent/enroll", async ({ request, env }) => ok(await enrollPrintAgent({ request, env }), { status: 201 }));
  router.post("/api/v1/print-agent/heartbeat", async ({ request, env }) => ok(await heartbeatPrintAgent({ request, env })));
  router.post("/api/v1/print-agent/jobs/claim", async ({ request, env }) => ok(await claimPrintJob({ request, env })));
  router.post("/api/v1/print-agent/jobs/:id/complete", async ({ request, env, params }) => ok(await completePrintJob({ request, env, jobId: params.id })));
  router.post("/api/v1/print-agent/jobs/:id/fail", async ({ request, env, params }) => ok(await failPrintJob({ request, env, jobId: params.id })));
}
