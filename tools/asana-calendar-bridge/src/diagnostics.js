const ASANA_API = "https://app.asana.com/api/1.0";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export default {
  async fetch(_request, env) {
    const result = {
      ok: false,
      service: "fioreze-asana-calendar-bridge-diagnostics",
      configured: {
        asanaAccessToken: Boolean(env.ASANA_ACCESS_TOKEN),
        asanaWorkspaceGid: Boolean(env.ASANA_WORKSPACE_GID),
        googleCalendarId: Boolean(env.GOOGLE_CALENDAR_ID),
        googleServiceAccount: Boolean(env.GOOGLE_SERVICE_ACCOUNT_JSON),
      },
      asana: { ok: false },
      googleOAuth: { ok: false },
      googleCalendarRead: { ok: false },
      googleCalendarWrite: { ok: false },
    };

    try {
      const asana = await testAsana(env);
      result.asana = { ok: true, ...asana };
    } catch (error) {
      result.asana.error = safeError(error);
    }

    let accessToken = null;
    try {
      accessToken = await getGoogleAccessToken(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      result.googleOAuth = { ok: true };
    } catch (error) {
      result.googleOAuth.error = safeError(error);
    }

    if (accessToken) {
      try {
        await googleRequest(`/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}`, accessToken);
        result.googleCalendarRead = { ok: true };
      } catch (error) {
        result.googleCalendarRead.error = safeError(error);
      }

      try {
        const probe = await createAndDeleteProbe(env.GOOGLE_CALENDAR_ID, accessToken);
        result.googleCalendarWrite = { ok: true, ...probe };
      } catch (error) {
        result.googleCalendarWrite.error = safeError(error);
      }
    }

    result.ok =
      result.asana.ok &&
      result.googleOAuth.ok &&
      result.googleCalendarRead.ok &&
      result.googleCalendarWrite.ok;

    return jsonResponse(result, result.ok ? 200 : 503);
  },

  async scheduled() {
    // Diagnostic deployment: intentionally no-op while this temporary build is active.
  },
};

async function testAsana(env) {
  if (!env.ASANA_ACCESS_TOKEN || !env.ASANA_WORKSPACE_GID) {
    throw new Error("Missing Asana configuration");
  }

  let offset = null;
  let tasks = 0;
  let scheduledTasks = 0;

  do {
    const params = new URLSearchParams({
      assignee: "me",
      workspace: env.ASANA_WORKSPACE_GID,
      completed_since: "now",
      limit: "100",
      opt_fields: "gid,due_on,due_at",
    });
    if (offset) params.set("offset", offset);

    const response = await fetch(`${ASANA_API}/tasks?${params}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${env.ASANA_ACCESS_TOKEN}`,
      },
    });
    const payload = await parseJsonResponse(response, "Asana");
    for (const task of payload.data || []) {
      tasks += 1;
      if (task.due_on || task.due_at) scheduledTasks += 1;
    }
    offset = payload.next_page?.offset || null;
  } while (offset);

  return { tasks, scheduledTasks };
}

async function createAndDeleteProbe(calendarId, accessToken) {
  if (!calendarId) throw new Error("Missing Google Calendar ID");

  const start = new Date(Date.now() + 5 * 60_000);
  const end = new Date(start.getTime() + 5 * 60_000);
  const created = await googleRequest(
    `/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
    accessToken,
    {
      method: "POST",
      body: {
        summary: "[Fioreze bridge diagnostic]",
        description: "Temporary event created automatically to verify Calendar write permission.",
        transparency: "transparent",
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    },
  );

  if (!created?.id) throw new Error("Google Calendar created no event ID");

  await googleRequest(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(created.id)}?sendUpdates=none`,
    accessToken,
    { method: "DELETE" },
  );

  return { probeCreated: true, probeDeleted: true };
}

async function googleRequest(path, accessToken, options = {}) {
  const response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) return null;
  return parseJsonResponse(response, "Google Calendar");
}

async function getGoogleAccessToken(serviceAccountJson) {
  if (!serviceAccountJson) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON");

  let credentials;
  try {
    credentials = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("Service account JSON is missing client_email or private_key");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlEncode(
    JSON.stringify({
      iss: credentials.client_email,
      scope: GOOGLE_CALENDAR_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsignedToken = `${header}.${claims}`;
  const privateKey = await importPkcs8PrivateKey(credentials.private_key);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    new TextEncoder().encode(unsignedToken),
  );
  const assertion = `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const payload = await parseJsonResponse(response, "Google OAuth");
  if (!payload.access_token) throw new Error("Google OAuth returned no access_token");
  return payload.access_token;
}

async function importPkcs8PrivateKey(pem) {
  const normalizedPem = pem.replace(/\\n/g, "\n");
  const base64 = normalizedPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

  if (!base64) throw new Error("Google service account private key is empty");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  return crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function parseJsonResponse(response, serviceName) {
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text.slice(0, 500) };
    }
  }

  if (!response.ok) {
    const details = payload ? JSON.stringify(payload).slice(0, 700) : "no response body";
    throw new Error(`${serviceName} request failed (${response.status}): ${details}`);
  }
  return payload || {};
}

function safeError(error) {
  return String(error?.message || error || "Unknown error").slice(0, 900);
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
