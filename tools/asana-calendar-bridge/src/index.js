const ASANA_API = "https://app.asana.com/api/1.0";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return jsonResponse({
        ok: true,
        service: "fioreze-asana-calendar-bridge",
        bridgeId: env.BRIDGE_ID || "fioreze-asana-my-tasks-v1",
        configured: configurationStatus(env),
        schedule: "*/5 * * * *",
      });
    }

    return jsonResponse({ ok: false, error: "Not found" }, 404);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      syncAsanaToGoogleCalendar(env)
        .then((result) => console.log("Asana Calendar sync complete", JSON.stringify(result)))
        .catch((error) => console.error("Asana Calendar sync failed", error?.stack || String(error))),
    );
  },
};

function configurationStatus(env) {
  return {
    asanaAccessToken: Boolean(env.ASANA_ACCESS_TOKEN),
    asanaWorkspaceGid: Boolean(env.ASANA_WORKSPACE_GID),
    googleCalendarId: Boolean(env.GOOGLE_CALENDAR_ID),
    googleServiceAccount: Boolean(env.GOOGLE_SERVICE_ACCOUNT_JSON),
  };
}

function assertConfiguration(env) {
  const missing = Object.entries({
    ASANA_ACCESS_TOKEN: env.ASANA_ACCESS_TOKEN,
    ASANA_WORKSPACE_GID: env.ASANA_WORKSPACE_GID,
    GOOGLE_CALENDAR_ID: env.GOOGLE_CALENDAR_ID,
    GOOGLE_SERVICE_ACCOUNT_JSON: env.GOOGLE_SERVICE_ACCOUNT_JSON,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing Worker secrets: ${missing.join(", ")}`);
  }
}

async function syncAsanaToGoogleCalendar(env) {
  assertConfiguration(env);

  const [tasks, googleAccessToken] = await Promise.all([
    fetchAllAsanaTasks(env),
    getGoogleAccessToken(env.GOOGLE_SERVICE_ACCOUNT_JSON),
  ]);

  const scheduledTasks = tasks.filter(hasSchedule);
  const bridgeId = env.BRIDGE_ID || "fioreze-asana-my-tasks-v1";
  const calendarId = env.GOOGLE_CALENDAR_ID;
  const existingEvents = await listManagedGoogleEvents(calendarId, googleAccessToken, bridgeId);

  const eventsByTask = new Map();
  const duplicateEvents = [];

  for (const event of existingEvents) {
    const taskGid = event.extendedProperties?.private?.asanaTaskGid;
    if (!taskGid) continue;

    if (eventsByTask.has(taskGid)) {
      duplicateEvents.push(event);
    } else {
      eventsByTask.set(taskGid, event);
    }
  }

  const scheduledTaskGids = new Set(scheduledTasks.map((task) => task.gid));
  const stats = {
    asanaTasks: tasks.length,
    scheduledTasks: scheduledTasks.length,
    existingEvents: existingEvents.length,
    created: 0,
    updated: 0,
    deleted: 0,
    unchanged: 0,
    duplicateEventsDeleted: 0,
  };

  await mapLimit(scheduledTasks, 8, async (task) => {
    const desired = buildGoogleEvent(task, env);
    const existing = eventsByTask.get(task.gid);

    if (!existing) {
      await googleRequest(
        `/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
        googleAccessToken,
        { method: "POST", body: desired },
      );
      stats.created += 1;
      return;
    }

    if (eventMatches(existing, desired)) {
      stats.unchanged += 1;
      return;
    }

    await googleRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existing.id)}?sendUpdates=none`,
      googleAccessToken,
      { method: "PATCH", body: desired },
    );
    stats.updated += 1;
  });

  const duplicateEventIds = new Set(duplicateEvents.map((event) => event.id));
  const staleEvents = existingEvents.filter((event) => {
    const taskGid = event.extendedProperties?.private?.asanaTaskGid;
    return taskGid && !scheduledTaskGids.has(taskGid) && !duplicateEventIds.has(event.id);
  });

  await mapLimit(staleEvents, 8, async (event) => {
    await deleteGoogleEvent(calendarId, event.id, googleAccessToken);
    stats.deleted += 1;
  });

  await mapLimit(duplicateEvents, 8, async (event) => {
    await deleteGoogleEvent(calendarId, event.id, googleAccessToken);
    stats.duplicateEventsDeleted += 1;
  });

  return stats;
}

async function fetchAllAsanaTasks(env) {
  const tasks = [];
  let offset = null;

  do {
    const params = new URLSearchParams({
      assignee: "me",
      workspace: env.ASANA_WORKSPACE_GID,
      completed_since: "now",
      limit: "100",
      opt_fields: [
        "gid",
        "name",
        "notes",
        "completed",
        "due_on",
        "due_at",
        "start_on",
        "start_at",
        "modified_at",
        "permalink_url",
        "memberships.project.name",
      ].join(","),
    });

    if (offset) params.set("offset", offset);

    const response = await fetch(`${ASANA_API}/tasks?${params}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${env.ASANA_ACCESS_TOKEN}`,
      },
    });

    const payload = await parseJsonResponse(response, "Asana");
    tasks.push(...(payload.data || []));
    offset = payload.next_page?.offset || null;
  } while (offset);

  return tasks;
}

function hasSchedule(task) {
  return Boolean(task?.due_at || task?.due_on);
}

function buildGoogleEvent(task, env) {
  const bridgeId = env.BRIDGE_ID || "fioreze-asana-my-tasks-v1";
  const durationMinutes = positiveInt(env.DEFAULT_EVENT_DURATION_MINUTES, 60);
  const transparency = env.GOOGLE_EVENT_TRANSPARENCY === "opaque" ? "opaque" : "transparent";
  const title = (task.name || "Tarefa do Asana").trim() || "Tarefa do Asana";
  const projects = [...new Set((task.memberships || []).map((item) => item.project?.name).filter(Boolean))];
  const taskUrl = task.permalink_url || `https://app.asana.com/0/0/${task.gid}/f`;
  const descriptionParts = [];

  if (task.notes?.trim()) descriptionParts.push(task.notes.trim());
  if (projects.length) descriptionParts.push(`Projeto: ${projects.join(", ")}`);
  descriptionParts.push(`Abrir no Asana: ${taskUrl}`);

  const event = {
    summary: title,
    description: descriptionParts.join("\n\n").slice(0, 8000),
    transparency,
    extendedProperties: {
      private: {
        asanaBridge: bridgeId,
        asanaTaskGid: task.gid,
      },
    },
  };

  if (task.due_at) {
    const start = task.start_at ? new Date(task.start_at) : new Date(task.due_at);
    let end = new Date(task.due_at);

    if (!task.start_at || end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + durationMinutes * 60_000);
    }

    event.start = { dateTime: start.toISOString() };
    event.end = { dateTime: end.toISOString() };
    return event;
  }

  const startDate = task.start_on || task.due_on;
  const endDate = addDays(task.due_on || startDate, 1);
  event.start = { date: startDate };
  event.end = { date: endDate };
  return event;
}

function eventMatches(existing, desired) {
  const comparableExisting = {
    summary: existing.summary || "",
    description: existing.description || "",
    transparency: existing.transparency || "opaque",
    start: normalizeEventBoundary(existing.start),
    end: normalizeEventBoundary(existing.end),
    asanaBridge: existing.extendedProperties?.private?.asanaBridge || "",
    asanaTaskGid: existing.extendedProperties?.private?.asanaTaskGid || "",
  };

  const comparableDesired = {
    summary: desired.summary || "",
    description: desired.description || "",
    transparency: desired.transparency || "opaque",
    start: normalizeEventBoundary(desired.start),
    end: normalizeEventBoundary(desired.end),
    asanaBridge: desired.extendedProperties?.private?.asanaBridge || "",
    asanaTaskGid: desired.extendedProperties?.private?.asanaTaskGid || "",
  };

  return JSON.stringify(comparableExisting) === JSON.stringify(comparableDesired);
}

function normalizeEventBoundary(boundary) {
  if (!boundary) return null;
  if (boundary.date) return { date: boundary.date };
  if (boundary.dateTime) return { dateTime: new Date(boundary.dateTime).toISOString() };
  return null;
}

async function listManagedGoogleEvents(calendarId, accessToken, bridgeId) {
  const events = [];
  let pageToken = null;

  do {
    const params = new URLSearchParams({
      privateExtendedProperty: `asanaBridge=${bridgeId}`,
      maxResults: "2500",
      showDeleted: "false",
      singleEvents: "true",
    });

    if (pageToken) params.set("pageToken", pageToken);

    const payload = await googleRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      accessToken,
    );

    events.push(...(payload.items || []));
    pageToken = payload.nextPageToken || null;
  } while (pageToken);

  return events;
}

async function deleteGoogleEvent(calendarId, eventId, accessToken) {
  await googleRequest(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    accessToken,
    { method: "DELETE" },
  );
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
  let credentials;

  try {
    credentials = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must contain client_email and private_key");
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
  if (!payload.access_token) throw new Error("Google OAuth did not return an access_token");
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

function addDays(dateString, amount) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid Asana date: ${dateString}`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function parseJsonResponse(response, serviceName) {
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text.slice(0, 1000) };
    }
  }

  if (!response.ok) {
    const details = payload ? JSON.stringify(payload).slice(0, 1500) : "no response body";
    throw new Error(`${serviceName} request failed (${response.status}): ${details}`);
  }

  return payload || {};
}

async function mapLimit(items, limit, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(runners);
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
