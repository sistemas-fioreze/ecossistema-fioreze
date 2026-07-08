export const ADMIN_MUTATION_HEADER = "x-fioreze-admin-action";
export const ADMIN_MUTATION_HEADER_VALUE = "erp-admin";

export async function adminApi(path, options = {}) {
  const init = {
    method: options.method || "GET",
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(requiresAdminMutationHeader(options) ? { [ADMIN_MUTATION_HEADER]: ADMIN_MUTATION_HEADER_VALUE } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  };
  const response = await fetch(path, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    const error = new Error(payload.error?.message || "Falha na API administrativa.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

function requiresAdminMutationHeader(options) {
  return String(options.method || "GET").toUpperCase() !== "GET";
}
