export async function apiGet(path) {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  return parseApiResponse(response);
}

export async function apiPost(path, body, { idempotencyKey } = {}) {
  const headers = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const response = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return parseApiResponse(response);
}

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const message = payload?.error?.message || "Falha ao comunicar com a API local.";
    throw new Error(message);
  }
  return payload.data;
}
