import worker from "../../src/index.js";
import { createRequest, createTestEnv, readJson } from "./mock-d1.js";

export function createWorkerTestContext(overrides = {}) {
  const env = createTestEnv(overrides);
  const waitUntilPromises = [];
  const ctx = {
    waitUntil(promise) {
      waitUntilPromises.push(Promise.resolve(promise));
    },
  };

  return {
    env,
    ctx,
    async fetch(path, init = {}) {
      return worker.fetch(createRequest(path, init), env, ctx);
    },
    async json(path, init = {}) {
      const response = await worker.fetch(createRequest(path, init), env, ctx);
      return {
        response,
        body: await readJson(response),
      };
    },
    async flushWaitUntil() {
      await Promise.all(waitUntilPromises.splice(0));
    },
  };
}

export function jsonPost(body, headers = {}) {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `test-${crypto.randomUUID()}`,
      "x-fioreze-test-now": "2026-07-05T20:00:00.000Z",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}
