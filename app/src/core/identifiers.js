const SAFE_IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;

export function isSafeIdentifier(value) {
  return typeof value === "string" && SAFE_IDENTIFIER.test(value);
}

export function assertSafeIdentifier(value, label) {
  if (!isSafeIdentifier(value)) {
    throw new Error(`${label} invalido.`);
  }
}

export function isValidIdempotencyKey(value) {
  return typeof value === "string" && IDEMPOTENCY_KEY.test(value);
}

export function createPublicId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}
