import { badRequest } from "./errors.js";

export function nowIso() {
  return new Date().toISOString();
}

export function requestNow({ request, env }) {
  const testNow = request?.headers?.get("x-fioreze-test-now");
  if (testNow && env?.ENVIRONMENT === "test") {
    const date = new Date(testNow);
    if (Number.isNaN(date.getTime())) throw badRequest("x-fioreze-test-now invalido.");
    return date.toISOString();
  }
  return nowIso();
}
