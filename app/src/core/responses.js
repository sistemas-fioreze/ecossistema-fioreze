export const API_VERSION = "v1";

function requestId() {
  return crypto.randomUUID();
}

export function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", init.cacheControl || "no-store");
  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

export function ok(data, init = {}) {
  return jsonResponse(
    {
      ok: true,
      data,
      meta: {
        api_version: API_VERSION,
        request_id: init.requestId || requestId(),
      },
    },
    { status: init.status || 200, headers: init.headers, cacheControl: init.cacheControl },
  );
}

export function fail(status, code, message, details = undefined, init = {}) {
  return jsonResponse(
    {
      ok: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        api_version: API_VERSION,
        request_id: init.requestId || requestId(),
      },
    },
    { status, headers: init.headers },
  );
}

export function notFound(message = "Recurso nao encontrado.") {
  return fail(404, "not_found", message);
}

export function methodNotAllowed(allowed = []) {
  return fail(405, "method_not_allowed", "Metodo nao permitido.", { allowed });
}
