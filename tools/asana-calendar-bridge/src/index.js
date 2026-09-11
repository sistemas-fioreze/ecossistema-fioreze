const ASANA_API = "https://app.asana.com/api/1.0";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TASKS_API = "https://tasks.googleapis.com/tasks/v1";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GOOGLE_TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";
const FALLBACK_CRON = "* * * * *";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return jsonResponse({
        ok: true,
        service: "fioreze-asana-calendar-bridge",
        bridgeId: bridgeId(env),
        mode: hybridReady(env) ? "hybrid-google-tasks" : "legacy-calendar-events",
        configured: configurationStatus(env),
        schedule: FALLBACK_CRON,
        realtime: {
          asanaToGoogle: "Asana webhook (User Task List)",
          googleToAsana: "1-minute fallback polling",
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/oauth/start") {
      return startGoogleTasksOAuth(request, env);
    }

    if (request.method === "GET" && url.pathname === "/oauth/callback") {
      return finishGoogleTasksOAuth(request, env);
    }

    if (request.method === "POST" && url.pathname === "/internal/asana-webhook/setup") {
      try {
        return jsonResponse(await ensureAsanaWebhook(request, env));
      } catch (error) {
        console.error("Asana webhook setup failed", error?.stack || String(error));
        return jsonResponse({ ok: false, error: String(error?.message || error) }, 500);
      }
    }

    if (request.method === "POST" && url.pathname.startsWith("/webhooks/asana/")) {
      return handleAsanaWebhook(request, env, ctx);
    }

    return jsonResponse({ ok: false, error: "Not found" }, 404);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runSync(env, "fallback-cron"));
  },
};

function bridgeId(env) {
  return env.BRIDGE_ID || "fioreze-asana-my-tasks-v1";
}

function configurationStatus(env) {
  return {
    asanaAccessToken: Boolean(env.ASANA_ACCESS_TOKEN),
    asanaWorkspaceGid: Boolean(env.ASANA_WORKSPACE_GID),
    googleCalendarId: Boolean(env.GOOGLE_CALENDAR_ID),
    googleServiceAccount: Boolean(env.GOOGLE_SERVICE_ACCOUNT_JSON),
    googleTasksClientId: Boolean(env.GOOGLE_OAUTH_CLIENT_ID),
    googleTasksClientSecret: Boolean(env.GOOGLE_OAUTH_CLIENT_SECRET),
    googleTasksRefreshToken: Boolean(env.GOOGLE_OAUTH_REFRESH_TOKEN),
    hybridReady: hybridReady(env),
  };
}

function hybridReady(env) {
  return Boolean(
    env.GOOGLE_OAUTH_CLIENT_ID &&
      env.GOOGLE_OAUTH_CLIENT_SECRET &&
      env.GOOGLE_OAUTH_REFRESH_TOKEN,
  );
}

function assertBaseConfiguration(env) {
  const missing = Object.entries({
    ASANA_ACCESS_TOKEN: env.ASANA_ACCESS_TOKEN,
    ASANA_WORKSPACE_GID: env.ASANA_WORKSPACE_GID,
    GOOGLE_CALENDAR_ID: env.GOOGLE_CALENDAR_ID,
    GOOGLE_SERVICE_ACCOUNT_JSON: env.GOOGLE_SERVICE_ACCOUNT_JSON,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) throw new Error(`Missing Worker configuration: ${missing.join(", ")}`);
}

async function runSync(env, source) {
  try {
    const result = await syncBridge(env);
    console.log("Asana Google sync complete", JSON.stringify({ source, ...result }));
    return result;
  } catch (error) {
    console.error("Asana Google sync failed", JSON.stringify({ source, error: error?.stack || String(error) }));
    throw error;
  }
}

async function handleAsanaWebhook(request, env, ctx) {
  assertBaseConfiguration(env);
  const url = new URL(request.url);
  const expectedPath = await asanaWebhookPath(env);

  if (url.pathname !== expectedPath) {
    return jsonResponse({ ok: false, error: "Not found" }, 404);
  }

  const handshakeSecret = request.headers.get("X-Hook-Secret");
  if (handshakeSecret) {
    return new Response(null, {
      status: 200,
      headers: { "X-Hook-Secret": handshakeSecret },
    });
  }

  // Asana signs normal webhook deliveries. The unguessable URL token is derived
  // from the PAT so the signing secret does not need separate persistent storage.
  if (!request.headers.get("X-Hook-Signature")) {
    return jsonResponse({ ok: false, error: "Missing Asana signature" }, 401);
  }

  // Respond immediately; the full reconciliation runs after the HTTP response.
  ctx.waitUntil(runSync(env, "asana-webhook"));
  return new Response(null, { status: 204 });
}

async function ensureAsanaWebhook(request, env) {
  assertBaseConfiguration(env);

  const userTaskListPayload = await asanaRequest(
    env,
    `/users/me/user_task_list?workspace=${encodeURIComponent(env.ASANA_WORKSPACE_GID)}&opt_fields=gid,name`,
  );
  const userTaskList = userTaskListPayload.data;
  if (!userTaskList?.gid) throw new Error("Asana did not return the My Tasks user task list GID");

  const origin = new URL(request.url).origin;
  const target = `${origin}${await asanaWebhookPath(env)}`;
  const params = new URLSearchParams({
    workspace: env.ASANA_WORKSPACE_GID,
    resource: userTaskList.gid,
    limit: "100",
    opt_fields: "gid,target,active,resource.gid",
  });
  const existingPayload = await asanaRequest(env, `/webhooks?${params}`);
  const existing = (existingPayload.data || []).find((webhook) => webhook.target === target);

  if (existing) {
    return {
      ok: true,
      created: false,
      active: existing.active !== false,
      resource: "my-tasks",
      delivery: "webhook",
      fallback: "1-minute-cron",
    };
  }

  const createdPayload = await asanaRequest(env, "/webhooks", {
    method: "POST",
    body: {
      data: {
        resource: userTaskList.gid,
        target,
      },
    },
  });

  return {
    ok: true,
    created: true,
    active: createdPayload.data?.active !== false,
    resource: "my-tasks",
    delivery: "webhook",
    fallback: "1-minute-cron",
  };
}

async function asanaWebhookPath(env) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`fioreze-asana-webhook:${env.ASANA_ACCESS_TOKEN}`),
  );
  const token = base64UrlEncode(new Uint8Array(digest)).slice(0, 36);
  return `/webhooks/asana/${token}`;
}

async function syncBridge(env) {
  assertBaseConfiguration(env);
  if (hybridReady(env)) return syncHybrid(env);
  return syncLegacyCalendar(env);
}

async function syncLegacyCalendar(env) {
  const [tasks, calendarAccessToken] = await Promise.all([
    fetchAllIncompleteAsanaTasks(env),
    getServiceAccountAccessToken(env.GOOGLE_SERVICE_ACCOUNT_JSON),
  ]);
  const scheduledTasks = tasks.filter(hasSchedule);
  const calendar = await syncCalendarEvents(env, scheduledTasks, calendarAccessToken);
  return { mode: "legacy-calendar-events", asanaTasks: tasks.length, ...calendar };
}

async function syncHybrid(env) {
  const [asanaTasks, asanaMe, calendarAccessToken, tasksAccessToken] = await Promise.all([
    fetchAllIncompleteAsanaTasks(env),
    fetchAsanaMe(env),
    getServiceAccountAccessToken(env.GOOGLE_SERVICE_ACCOUNT_JSON),
    getGoogleTasksAccessToken(env),
  ]);

  const taskList = await ensureGoogleTaskList(tasksAccessToken, env.GOOGLE_TASKLIST_TITLE || "Asana");
  const googleTasks = await listGoogleTasks(taskList.id, tasksAccessToken);
  const managed = indexManagedGoogleTasks(googleTasks, bridgeId(env));
  const incompleteByGid = new Map(asanaTasks.map((task) => [task.gid, task]));
  const stats = {
    mode: "hybrid-google-tasks",
    asanaTasks: asanaTasks.length,
    googleTaskList: taskList.title,
    googleTasksCreated: 0,
    googleTasksUpdated: 0,
    googleTasksCompleted: 0,
    googleTasksReopened: 0,
    googleTasksDeleted: 0,
    asanaCompletedFromGoogle: 0,
    duplicateGoogleTasksDeleted: 0,
  };

  for (const duplicate of managed.duplicates) {
    await deleteGoogleTask(taskList.id, duplicate.id, tasksAccessToken);
    stats.duplicateGoogleTasksDeleted += 1;
  }

  for (const task of asanaTasks) {
    const existing = managed.byAsanaGid.get(task.gid);

    // No date means it should not exist in either Google Tasks or Calendar.
    if (!hasSchedule(task)) {
      if (existing && !existing.deleted) {
        await deleteGoogleTask(taskList.id, existing.id, tasksAccessToken);
        stats.googleTasksDeleted += 1;
      }
      continue;
    }

    // Timed Asana tasks remain real Calendar events, never Google Tasks.
    if (task.due_at) {
      if (existing && !existing.deleted) {
        await deleteGoogleTask(taskList.id, existing.id, tasksAccessToken);
        stats.googleTasksDeleted += 1;
      }
      continue;
    }

    if (existing?.status === "completed" && !existing.deleted) {
      const asanaChanged = Date.parse(task.modified_at || 0);
      const googleChanged = Date.parse(existing.updated || 0);
      if (googleChanged > asanaChanged) {
        await updateAsanaCompletion(env, task.gid, true);
        incompleteByGid.delete(task.gid);
        stats.asanaCompletedFromGoogle += 1;
        continue;
      }
      const desired = buildGoogleTask(task, env, "needsAction");
      await patchGoogleTask(taskList.id, existing.id, desired, tasksAccessToken);
      stats.googleTasksReopened += 1;
      continue;
    }

    const desired = buildGoogleTask(task, env, "needsAction");
    if (!existing || existing.deleted) {
      await createGoogleTask(taskList.id, desired, tasksAccessToken);
      stats.googleTasksCreated += 1;
    } else if (!googleTaskMatches(existing, desired)) {
      await patchGoogleTask(taskList.id, existing.id, desired, tasksAccessToken);
      stats.googleTasksUpdated += 1;
    }
  }

  // Google Tasks that are no longer in the incomplete My Tasks result need one detail lookup.
  const stalePending = [...managed.byAsanaGid.entries()].filter(
    ([gid, task]) => task.status !== "completed" && !task.deleted && !incompleteByGid.has(gid),
  );

  await mapLimit(stalePending, 6, async ([gid, googleTask]) => {
    const asana = await fetchAsanaTaskSafe(env, gid);
    if (!asana) {
      await deleteGoogleTask(taskList.id, googleTask.id, tasksAccessToken);
      stats.googleTasksDeleted += 1;
      return;
    }

    if (asana.completed) {
      await patchGoogleTask(
        taskList.id,
        googleTask.id,
        { status: "completed", completed: new Date().toISOString() },
        tasksAccessToken,
      );
      stats.googleTasksCompleted += 1;
      return;
    }

    const stillMine = asana.assignee?.gid === asanaMe.gid;
    if (!stillMine || !hasSchedule(asana) || asana.due_at) {
      await deleteGoogleTask(taskList.id, googleTask.id, tasksAccessToken);
      stats.googleTasksDeleted += 1;
    }
  });

  const activeAsanaTasks = [...incompleteByGid.values()];
  const timedTasks = activeAsanaTasks.filter((task) => Boolean(task.due_at));
  const calendar = await syncCalendarEvents(env, timedTasks, calendarAccessToken);

  return { ...stats, timedTasks: timedTasks.length, ...calendar };
}

async function fetchAllIncompleteAsanaTasks(env) {
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
        "assignee.gid",
      ].join(","),
    });
    if (offset) params.set("offset", offset);
    const payload = await asanaRequest(env, `/tasks?${params}`);
    tasks.push(...(payload.data || []));
    offset = payload.next_page?.offset || null;
  } while (offset);
  return tasks;
}

async function fetchAsanaMe(env) {
  const payload = await asanaRequest(env, "/users/me?opt_fields=gid,name");
  return payload.data;
}

async function fetchAsanaTaskSafe(env, gid) {
  try {
    const payload = await asanaRequest(
      env,
      `/tasks/${encodeURIComponent(gid)}?opt_fields=gid,completed,modified_at,due_on,due_at,start_on,start_at,assignee.gid,name,notes,permalink_url,memberships.project.name`,
    );
    return payload.data;
  } catch (error) {
    if (String(error?.message || error).includes("(404)")) return null;
    throw error;
  }
}

async function updateAsanaCompletion(env, gid, completed) {
  return asanaRequest(env, `/tasks/${encodeURIComponent(gid)}`, {
    method: "PUT",
    body: { data: { completed } },
  });
}

async function asanaRequest(env, path, options = {}) {
  const response = await fetch(`${ASANA_API}${path}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.ASANA_ACCESS_TOKEN}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return parseJsonResponse(response, "Asana");
}

function hasSchedule(task) {
  return Boolean(task?.due_at || task?.due_on);
}

function buildGoogleTask(task, env, status = "needsAction") {
  const title = (task.name || "Tarefa do Asana").trim() || "Tarefa do Asana";
  const projects = [...new Set((task.memberships || []).map((item) => item.project?.name).filter(Boolean))];
  const taskUrl = task.permalink_url || `https://app.asana.com/0/0/${task.gid}/f`;
  const notes = [];
  if (task.notes?.trim()) notes.push(task.notes.trim());
  if (projects.length) notes.push(`Projeto: ${projects.join(", ")}`);
  if (task.start_on && task.start_on !== task.due_on) notes.push(`Início no Asana: ${task.start_on}`);
  notes.push(`Abrir no Asana: ${taskUrl}`);
  notes.push(`Bridge ID: ${bridgeId(env)}`);
  notes.push(`Asana Task GID: ${task.gid}`);

  return {
    title,
    notes: notes.join("\n\n").slice(0, 7900),
    due: `${task.due_on}T00:00:00.000Z`,
    status,
    ...(status === "needsAction" ? { completed: null } : {}),
  };
}

function extractManagedAsanaGid(task, id) {
  const notes = task?.notes || "";
  if (!notes.includes(`Bridge ID: ${id}`)) return null;
  const match = notes.match(/^Asana Task GID:\s*(\d+)\s*$/m);
  return match?.[1] || null;
}

function indexManagedGoogleTasks(tasks, id) {
  const byAsanaGid = new Map();
  const duplicates = [];
  for (const task of tasks) {
    const gid = extractManagedAsanaGid(task, id);
    if (!gid) continue;
    if (!byAsanaGid.has(gid)) {
      byAsanaGid.set(gid, task);
      continue;
    }
    const current = byAsanaGid.get(gid);
    if (Date.parse(task.updated || 0) > Date.parse(current.updated || 0)) {
      duplicates.push(current);
      byAsanaGid.set(gid, task);
    } else {
      duplicates.push(task);
    }
  }
  return { byAsanaGid, duplicates };
}

function googleTaskMatches(existing, desired) {
  return (
    (existing.title || "") === desired.title &&
    (existing.notes || "") === desired.notes &&
    normalizeGoogleTaskDue(existing.due) === normalizeGoogleTaskDue(desired.due) &&
    (existing.status || "needsAction") === desired.status
  );
}

function normalizeGoogleTaskDue(value) {
  return value ? String(value).slice(0, 10) : "";
}

async function ensureGoogleTaskList(accessToken, title) {
  let pageToken = null;
  do {
    const params = new URLSearchParams({ maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const payload = await googleTasksRequest(`/users/@me/lists?${params}`, accessToken);
    const existing = (payload.items || []).find((item) => item.title === title);
    if (existing) return existing;
    pageToken = payload.nextPageToken || null;
  } while (pageToken);
  return googleTasksRequest("/users/@me/lists", accessToken, { method: "POST", body: { title } });
}

async function listGoogleTasks(taskListId, accessToken) {
  const tasks = [];
  let pageToken = null;
  do {
    const params = new URLSearchParams({
      maxResults: "100",
      showCompleted: "true",
      showHidden: "true",
      showDeleted: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const payload = await googleTasksRequest(
      `/lists/${encodeURIComponent(taskListId)}/tasks?${params}`,
      accessToken,
    );
    tasks.push(...(payload.items || []));
    pageToken = payload.nextPageToken || null;
  } while (pageToken);
  return tasks;
}

function createGoogleTask(taskListId, body, accessToken) {
  return googleTasksRequest(`/lists/${encodeURIComponent(taskListId)}/tasks`, accessToken, {
    method: "POST",
    body,
  });
}

function patchGoogleTask(taskListId, taskId, body, accessToken) {
  return googleTasksRequest(
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    accessToken,
    { method: "PATCH", body },
  );
}

async function deleteGoogleTask(taskListId, taskId, accessToken) {
  await googleTasksRequest(
    `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    accessToken,
    { method: "DELETE" },
  );
}

async function googleTasksRequest(path, accessToken, options = {}) {
  const response = await fetch(`${GOOGLE_TASKS_API}${path}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (response.status === 204) return null;
  return parseJsonResponse(response, "Google Tasks");
}

async function syncCalendarEvents(env, desiredTasks, accessToken) {
  const calendarId = env.GOOGLE_CALENDAR_ID;
  const existingEvents = await listManagedGoogleEvents(calendarId, accessToken, bridgeId(env));
  const eventsByTask = new Map();
  const duplicates = [];

  for (const event of existingEvents) {
    const gid = event.extendedProperties?.private?.asanaTaskGid;
    if (!gid) continue;
    if (eventsByTask.has(gid)) duplicates.push(event);
    else eventsByTask.set(gid, event);
  }

  const desiredGids = new Set(desiredTasks.map((task) => task.gid));
  const stats = {
    existingEvents: existingEvents.length,
    calendarCreated: 0,
    calendarUpdated: 0,
    calendarDeleted: 0,
    calendarUnchanged: 0,
  };

  await mapLimit(desiredTasks, 8, async (task) => {
    const desired = buildGoogleEvent(task, env);
    const existing = eventsByTask.get(task.gid);
    if (!existing) {
      await googleCalendarRequest(
        `/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none`,
        accessToken,
        { method: "POST", body: desired },
      );
      stats.calendarCreated += 1;
    } else if (eventMatches(existing, desired)) {
      stats.calendarUnchanged += 1;
    } else {
      await googleCalendarRequest(
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existing.id)}?sendUpdates=none`,
        accessToken,
        { method: "PATCH", body: desired },
      );
      stats.calendarUpdated += 1;
    }
  });

  const duplicateIds = new Set(duplicates.map((event) => event.id));
  const stale = existingEvents.filter((event) => {
    const gid = event.extendedProperties?.private?.asanaTaskGid;
    return gid && !desiredGids.has(gid) && !duplicateIds.has(event.id);
  });

  await mapLimit([...stale, ...duplicates], 8, async (event) => {
    await googleCalendarRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}?sendUpdates=none`,
      accessToken,
      { method: "DELETE" },
    );
    stats.calendarDeleted += 1;
  });

  return stats;
}

function buildGoogleEvent(task, env) {
  const durationMinutes = positiveInt(env.DEFAULT_EVENT_DURATION_MINUTES, 60);
  const transparency = env.GOOGLE_EVENT_TRANSPARENCY === "opaque" ? "opaque" : "transparent";
  const title = (task.name || "Tarefa do Asana").trim() || "Tarefa do Asana";
  const projects = [...new Set((task.memberships || []).map((item) => item.project?.name).filter(Boolean))];
  const taskUrl = task.permalink_url || `https://app.asana.com/0/0/${task.gid}/f`;
  const descriptionParts = [];
  if (task.notes?.trim()) descriptionParts.push(task.notes.trim());
  if (projects.length) descriptionParts.push(`Projeto: ${projects.join(", ")}`);
  descriptionParts.push(`Abrir no Asana: ${taskUrl}`);

  const start = task.start_at ? new Date(task.start_at) : new Date(task.due_at);
  let end = new Date(task.due_at);
  if (!task.start_at || end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + durationMinutes * 60_000);
  }

  return {
    summary: title,
    description: descriptionParts.join("\n\n").slice(0, 8000),
    transparency,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: {
      private: { asanaBridge: bridgeId(env), asanaTaskGid: task.gid },
    },
  };
}

function eventMatches(existing, desired) {
  const a = {
    summary: existing.summary || "",
    description: existing.description || "",
    transparency: existing.transparency || "opaque",
    start: normalizeEventBoundary(existing.start),
    end: normalizeEventBoundary(existing.end),
    asanaBridge: existing.extendedProperties?.private?.asanaBridge || "",
    asanaTaskGid: existing.extendedProperties?.private?.asanaTaskGid || "",
  };
  const b = {
    summary: desired.summary || "",
    description: desired.description || "",
    transparency: desired.transparency || "opaque",
    start: normalizeEventBoundary(desired.start),
    end: normalizeEventBoundary(desired.end),
    asanaBridge: desired.extendedProperties?.private?.asanaBridge || "",
    asanaTaskGid: desired.extendedProperties?.private?.asanaTaskGid || "",
  };
  return JSON.stringify(a) === JSON.stringify(b);
}

function normalizeEventBoundary(boundary) {
  if (!boundary) return null;
  if (boundary.date) return { date: boundary.date };
  if (boundary.dateTime) return { dateTime: new Date(boundary.dateTime).toISOString() };
  return null;
}

async function listManagedGoogleEvents(calendarId, accessToken, id) {
  const events = [];
  let pageToken = null;
  do {
    const params = new URLSearchParams({
      privateExtendedProperty: `asanaBridge=${id}`,
      maxResults: "2500",
      showDeleted: "false",
      singleEvents: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const payload = await googleCalendarRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      accessToken,
    );
    events.push(...(payload.items || []));
    pageToken = payload.nextPageToken || null;
  } while (pageToken);
  return events;
}

async function googleCalendarRequest(path, accessToken, options = {}) {
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

async function getServiceAccountAccessToken(serviceAccountJson) {
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
  const payload = await tokenRequest(
    { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion },
    "Google service account OAuth",
  );
  if (!payload.access_token) {
    throw new Error("Google service account OAuth did not return an access_token");
  }
  return payload.access_token;
}

async function getGoogleTasksAccessToken(env) {
  const payload = await tokenRequest(
    {
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: env.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: "refresh_token",
    },
    "Google Tasks OAuth",
  );
  if (!payload.access_token) throw new Error("Google Tasks OAuth did not return an access_token");
  return payload.access_token;
}

async function tokenRequest(fields, serviceName) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
  return parseJsonResponse(response, serviceName);
}

async function startGoogleTasksOAuth(request, env) {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return jsonResponse(
      { ok: false, error: "Configure GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET first." },
      503,
    );
  }
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/oauth/callback`;
  const state = await createOAuthState(env.GOOGLE_OAUTH_CLIENT_SECRET);
  const auth = new URL(GOOGLE_AUTH_URL);
  auth.search = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_TASKS_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  return Response.redirect(auth.toString(), 302);
}

async function finishGoogleTasksOAuth(request, env) {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return htmlResponse(
      "<h1>OAuth não configurado</h1><p>Faltam GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET.</p>",
      503,
    );
  }
  const url = new URL(request.url);
  if (url.searchParams.get("error")) {
    return htmlResponse(
      `<h1>Autorização cancelada</h1><pre>${escapeHtml(url.searchParams.get("error"))}</pre>`,
      400,
    );
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !(await verifyOAuthState(state, env.GOOGLE_OAUTH_CLIENT_SECRET))) {
    return htmlResponse("<h1>OAuth inválido</h1><p>State ausente, inválido ou expirado.</p>", 400);
  }
  const redirectUri = `${url.origin}/oauth/callback`;
  const payload = await tokenRequest(
    {
      code,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    },
    "Google OAuth authorization code",
  );

  if (!payload.refresh_token) {
    return htmlResponse(
      "<h1>Sem refresh token</h1><p>Abra /oauth/start novamente. O Worker já solicita prompt=consent.</p>",
      503,
    );
  }
  const token = escapeHtml(payload.refresh_token);
  return htmlResponse(`<!doctype html><meta charset="utf-8"><title>Google Tasks autorizado</title><style>body{font-family:system-ui;max-width:760px;margin:48px auto;padding:0 20px}code{display:block;padding:16px;background:#f4f4f4;word-break:break-all;border-radius:10px}button{padding:10px 16px}</style><h1>Google Tasks autorizado</h1><p>Copie o token abaixo e salve na Cloudflare como Secret <b>GOOGLE_OAUTH_REFRESH_TOKEN</b>. Ele será mostrado somente nesta página.</p><code id="t">${token}</code><p><button onclick="navigator.clipboard.writeText(document.getElementById('t').textContent)">Copiar token</button></p><p>Depois de salvar o secret, o /health deve mostrar <b>hybridReady: true</b>.</p>`);
}

async function createOAuthState(secret) {
  const payload = `${Date.now()}.${crypto.randomUUID()}`;
  const sig = await hmacSha256(secret, payload);
  return `${base64UrlEncode(payload)}.${sig}`;
}

async function verifyOAuthState(state, secret) {
  const [encoded, sig] = state.split(".");
  if (!encoded || !sig) return false;
  let payload;
  try {
    payload = new TextDecoder().decode(base64UrlDecode(encoded));
  } catch {
    return false;
  }
  const [timestamp] = payload.split(".");
  if (!timestamp || Date.now() - Number(timestamp) > 10 * 60_000) return false;
  const expected = await hmacSha256(secret, payload);
  return timingSafeEqual(sig, expected);
}

async function hmacSha256(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function importPkcs8PrivateKey(pem) {
  const normalizedPem = pem.replace(/\\n/g, "\n");
  const base64 = normalizedPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  if (!base64) throw new Error("Google service account private key is empty");
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
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

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
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
    while (queue.length) await worker(queue.shift());
  });
  await Promise.all(runners);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
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

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
