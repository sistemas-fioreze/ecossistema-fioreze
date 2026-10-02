import { all, first, run } from "../core/database.js";
import { badRequest, unauthorized } from "../core/errors.js";

const ASANA_AUTH_URL = "https://app.asana.com/-/oauth_authorize";
const ASANA_TOKEN_URL = "https://app.asana.com/-/oauth_token";
const ASANA_REVOKE_URL = "https://app.asana.com/-/oauth_revoke";
const ASANA_API = "https://app.asana.com/api/1.0";
const ASANA_SCOPE = "openid email profile users:read workspaces:read projects:read tasks:read tasks:write";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

export async function getAsanaConnectionStatus({ env, session }) {
  const configured = asanaConfigured(env);
  const connection = await connectionRow(env, plannerUserId(session));
  return {
    provider: "asana",
    configured,
    connected: Boolean(configured && connection?.status === "active"),
    can_manage_tasks: hasGrantedScope(connection, "tasks:write"),
    connection: connection ? publicConnection(connection) : null,
  };
}

export async function startAsanaConnection({ request, env, session }) {
  requireAsanaConfiguration(env);
  const state = randomToken(32);
  const verifier = randomToken(64);
  const challenge = base64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const origin = oauthOrigin(request, env);
  const redirectUri = `${origin}/api/v1/social-planner/asana/callback`;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();
  await run(env, "DELETE FROM social_planner_asana_oauth_states WHERE expires_at <= ? OR used_at IS NOT NULL", [createdAt]);
  await run(env, `INSERT INTO social_planner_asana_oauth_states (
      state_hash, planner_user_id, code_verifier_encrypted, redirect_uri, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?)`, [
    await sha256Hex(state), plannerUserId(session), await encryptSecret(env, verifier), redirectUri, createdAt, expiresAt,
  ]);
  const url = new URL(ASANA_AUTH_URL);
  url.searchParams.set("client_id", env.ASANA_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("scope", ASANA_SCOPE);
  return { authorization_url: url.toString(), expires_at: expiresAt };
}

export async function completeAsanaConnection({ request, env, session, fetchImpl = fetch }) {
  requireAsanaConfiguration(env);
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  if (!state || !code || url.searchParams.get("error")) throw badRequest("A autorização do Asana não foi concluída.");
  const stateHash = await sha256Hex(state);
  const row = await first(env, `SELECT * FROM social_planner_asana_oauth_states
    WHERE state_hash = ? AND planner_user_id = ? AND used_at IS NULL AND expires_at > ?`, [
    stateHash, plannerUserId(session), new Date().toISOString(),
  ]);
  if (!row) throw unauthorized("A autorização do Asana expirou. Inicie a conexão novamente.");
  const tokens = await asanaFormRequest(fetchImpl, ASANA_TOKEN_URL, {
    grant_type: "authorization_code",
    client_id: env.ASANA_CLIENT_ID,
    client_secret: env.ASANA_CLIENT_SECRET,
    redirect_uri: row.redirect_uri,
    code,
    code_verifier: await decryptSecret(env, row.code_verifier_encrypted),
  });
  const accessToken = tokens.access_token;
  if (!accessToken) throw badRequest("O Asana não retornou uma credencial válida.");
  const profile = await asanaJsonRequest(fetchImpl, `${ASANA_API}/users/me?opt_fields=gid,name,email,workspaces.gid,workspaces.name`, accessToken);
  const workspaces = profile.data?.workspaces || [];
  const previous = await connectionRow(env, row.planner_user_id);
  const selected = workspaces.find((entry) => entry.gid === previous?.workspace_gid) || workspaces[0] || null;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();
  const refreshToken = tokens.refresh_token
    ? await encryptSecret(env, tokens.refresh_token)
    : previous?.refresh_token_encrypted || null;
  await run(env, `INSERT INTO social_planner_asana_connections (
      planner_user_id, provider_account_id, account_name, account_email,
      workspace_gid, workspace_name, access_token_encrypted, refresh_token_encrypted,
      access_token_expires_at, granted_scope, status, connected_at, updated_at, last_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL)
    ON CONFLICT(planner_user_id) DO UPDATE SET
      provider_account_id = excluded.provider_account_id,
      account_name = excluded.account_name,
      account_email = excluded.account_email,
      workspace_gid = excluded.workspace_gid,
      workspace_name = excluded.workspace_name,
      access_token_encrypted = excluded.access_token_encrypted,
      refresh_token_encrypted = excluded.refresh_token_encrypted,
      access_token_expires_at = excluded.access_token_expires_at,
      granted_scope = excluded.granted_scope,
      status = 'active', updated_at = excluded.updated_at, last_error = NULL`, [
    row.planner_user_id, profile.data?.gid || tokens.data?.gid || null,
    profile.data?.name || tokens.data?.name || null, profile.data?.email || tokens.data?.email || null,
    selected?.gid || null, selected?.name || null, await encryptSecret(env, accessToken), refreshToken,
    expiresAt, tokens.scope || ASANA_SCOPE, now, now,
  ]);
  await run(env, "UPDATE social_planner_asana_oauth_states SET used_at = ? WHERE state_hash = ?", [now, stateHash]);
  if (selected) await matchAsanaProjects({ env, plannerUserId: row.planner_user_id, workspaceGid: selected.gid, accessToken, fetchImpl });
  return { connected: true, account_email: profile.data?.email || tokens.data?.email || null };
}

export async function disconnectAsana({ env, session, fetchImpl = fetch }) {
  const userId = plannerUserId(session);
  const connection = await connectionRow(env, userId);
  if (connection?.access_token_encrypted && asanaConfigured(env)) {
    try {
      await fetchImpl(ASANA_REVOKE_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: await decryptSecret(env, connection.access_token_encrypted) }).toString(),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // Local disconnection must still succeed if Asana is temporarily unavailable.
    }
  }
  await run(env, "DELETE FROM social_planner_asana_connections WHERE planner_user_id = ?", [userId]);
  await run(env, "DELETE FROM social_planner_asana_project_mappings WHERE planner_user_id = ?", [userId]);
  return { disconnected: true };
}

export async function getAsanaSetup({ env, session, fetchImpl = fetch }) {
  const userId = plannerUserId(session);
  const status = await getAsanaConnectionStatus({ env, session });
  const units = await unitMappings(env, userId);
  if (!status.connected) return { ...status, workspaces: [], projects: [], units };
  const connection = await connectionRow(env, userId);
  try {
    const token = await validAccessToken(env, connection, fetchImpl);
    const profile = await asanaJsonRequest(fetchImpl, `${ASANA_API}/users/me?opt_fields=workspaces.gid,workspaces.name`, token);
    const workspaces = profile.data?.workspaces || [];
    const projects = connection.workspace_gid
      ? await listWorkspaceProjects(fetchImpl, token, connection.workspace_gid)
      : [];
    return { ...status, workspaces, projects, units: await unitMappings(env, userId) };
  } catch (error) {
    return { ...status, workspaces: [], projects: [], units, error: String(error?.message || "Falha ao consultar o Asana.") };
  }
}

export async function selectAsanaWorkspace({ env, session, input, fetchImpl = fetch }) {
  const userId = plannerUserId(session);
  const workspaceGid = String(input?.workspace_gid || "").trim();
  if (!workspaceGid) throw badRequest("Selecione um workspace do Asana.");
  const connection = await requireConnection(env, userId);
  const token = await validAccessToken(env, connection, fetchImpl);
  const profile = await asanaJsonRequest(fetchImpl, `${ASANA_API}/users/me?opt_fields=workspaces.gid,workspaces.name`, token);
  const workspace = (profile.data?.workspaces || []).find((entry) => entry.gid === workspaceGid);
  if (!workspace) throw badRequest("Esse workspace não está disponível para sua conta do Asana.");
  const now = new Date().toISOString();
  await run(env, `UPDATE social_planner_asana_connections
    SET workspace_gid = ?, workspace_name = ?, updated_at = ?, last_error = NULL WHERE planner_user_id = ?`, [
    workspace.gid, workspace.name, now, userId,
  ]);
  await matchAsanaProjects({ env, plannerUserId: userId, workspaceGid: workspace.gid, accessToken: token, fetchImpl });
  return getAsanaSetup({ env, session, fetchImpl });
}

export async function saveAsanaProjectMappings({ env, session, input, fetchImpl = fetch }) {
  const userId = plannerUserId(session);
  const connection = await requireConnection(env, userId);
  if (!connection.workspace_gid) throw badRequest("Selecione um workspace antes de mapear os projetos.");
  const token = await validAccessToken(env, connection, fetchImpl);
  const projects = await listWorkspaceProjects(fetchImpl, token, connection.workspace_gid);
  const projectById = new Map(projects.map((project) => [project.gid, project]));
  const allowedUnits = new Set((await all(env, "SELECT hotel_id FROM social_planner_asana_units")).map((unit) => unit.hotel_id));
  const mappings = Array.isArray(input?.mappings) ? input.mappings : [];
  const now = new Date().toISOString();
  for (const mapping of mappings) {
    const hotelId = String(mapping?.hotel_id || "");
    const projectGid = String(mapping?.project_gid || "");
    if (!allowedUnits.has(hotelId)) throw badRequest("Unidade inválida no mapeamento do Asana.");
    const project = projectGid ? projectById.get(projectGid) : null;
    if (projectGid && !project) throw badRequest("Projeto do Asana indisponível para a conta conectada.");
    await upsertProjectMapping(env, {
      plannerUserId: userId, hotelId, workspaceGid: connection.workspace_gid,
      projectGid: project?.gid || null, projectName: project?.name || null,
      matchStatus: project ? "matched" : "missing", now,
    });
  }
  return getAsanaSetup({ env, session, fetchImpl });
}

export async function listAsanaCalendarTasks({ env, session, searchParams, fetchImpl = fetch }) {
  const start = searchParams.get("start_date") || "";
  const end = searchParams.get("end_date") || "";
  const hotelFilter = searchParams.get("hotel_id") || "all";
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end) || start > end) throw badRequest("Período inválido para o calendário do Asana.");
  const userId = plannerUserId(session);
  const connection = await requireConnection(env, userId);
  const token = await validAccessToken(env, connection, fetchImpl);
  const mappings = (await unitMappings(env, userId)).filter((unit) => unit.project_gid && (hotelFilter === "all" || unit.hotel_id === hotelFilter));
  const uniqueTasks = new Map();
  for (const mapping of mappings) {
    const tasks = await listProjectTasks(fetchImpl, token, mapping.project_gid, start);
    for (const task of tasks) {
      const startDate = task.start_on || task.start_at?.slice(0, 10) || task.due_on || task.due_at?.slice(0, 10) || null;
      const endDate = task.due_on || task.due_at?.slice(0, 10) || startDate;
      if (startDate && (endDate < start || startDate > end)) continue;
      const key = `${mapping.hotel_id}:${task.gid}`;
      uniqueTasks.set(key, {
        gid: task.gid, name: task.name, completed: Boolean(task.completed),
        start_date: startDate, end_date: endDate, due_at: task.due_at || null,
        has_start_date: Boolean(task.start_on || task.start_at),
        permalink_url: task.permalink_url || null, assignee_name: task.assignee?.name || null,
        section_name: task.memberships?.find((membership) => membership.project?.gid === mapping.project_gid)?.section?.name || null,
        hotel_id: mapping.hotel_id, hotel_name: mapping.hotel_name,
        project_gid: mapping.project_gid, project_name: mapping.project_name,
      });
    }
  }
  await run(env, "UPDATE social_planner_asana_connections SET last_sync_at = ?, last_error = NULL WHERE planner_user_id = ?", [new Date().toISOString(), userId]);
  return [...uniqueTasks.values()].sort((a, b) => String(a.start_date || "9999").localeCompare(String(b.start_date || "9999")) || a.name.localeCompare(b.name, "pt-BR"));
}

export async function getAsanaTask({ env, session, taskGid, fetchImpl = fetch }) {
  const userId = plannerUserId(session);
  const connection = await requireConnection(env, userId);
  const token = await validAccessToken(env, connection, fetchImpl);
  const task = await fetchAsanaTask(fetchImpl, token, taskGid);
  const mapping = await requireMappedTask(env, userId, task);
  return publicTask(task, mapping);
}

export async function updateAsanaTask({ env, session, taskGid, input, fetchImpl = fetch }) {
  const userId = plannerUserId(session);
  const connection = await requireConnection(env, userId);
  if (!hasGrantedScope(connection, "tasks:write")) throw unauthorized("Reconecte sua conta do Asana para liberar a edição de tarefas.");
  const token = await validAccessToken(env, connection, fetchImpl);
  const current = await fetchAsanaTask(fetchImpl, token, taskGid);
  const mapping = await requireMappedTask(env, userId, current);
  const data = taskUpdateInput(input);
  if (!Object.keys(data).length) throw badRequest("Nenhuma alteração válida foi informada.");
  const fields = taskFields();
  const payload = await asanaJsonRequest(
    fetchImpl,
    `${ASANA_API}/tasks/${encodeURIComponent(taskGid)}?opt_fields=${encodeURIComponent(fields)}`,
    token,
    { method: "PUT", body: { data } },
  );
  return publicTask(payload.data, mapping);
}

async function matchAsanaProjects({ env, plannerUserId, workspaceGid, accessToken, fetchImpl }) {
  const projects = await listWorkspaceProjects(fetchImpl, accessToken, workspaceGid);
  const byName = new Map(projects.map((project) => [normalizeName(project.name), project]));
  const units = await all(env, "SELECT hotel_id, project_name FROM social_planner_asana_units ORDER BY sort_order");
  const now = new Date().toISOString();
  for (const unit of units) {
    const project = byName.get(normalizeName(unit.project_name));
    await upsertProjectMapping(env, {
      plannerUserId, hotelId: unit.hotel_id, workspaceGid,
      projectGid: project?.gid || null, projectName: project?.name || null,
      matchStatus: project ? "matched" : "missing", now,
    });
  }
}

async function upsertProjectMapping(env, values) {
  await run(env, `INSERT INTO social_planner_asana_project_mappings (
      planner_user_id, hotel_id, workspace_gid, project_gid, project_name,
      match_status, matched_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(planner_user_id, hotel_id) DO UPDATE SET
      workspace_gid = excluded.workspace_gid, project_gid = excluded.project_gid,
      project_name = excluded.project_name, match_status = excluded.match_status,
      matched_at = excluded.matched_at, updated_at = excluded.updated_at`, [
    values.plannerUserId, values.hotelId, values.workspaceGid, values.projectGid,
    values.projectName, values.matchStatus, values.projectGid ? values.now : null, values.now,
  ]);
}

async function unitMappings(env, userId) {
  return all(env, `SELECT u.hotel_id, h.display_name AS hotel_name, u.project_name AS expected_project_name,
      m.project_gid, m.project_name, COALESCE(m.match_status, 'missing') AS match_status
    FROM social_planner_asana_units u
    JOIN social_planner_hotels h ON h.hotel_id = u.hotel_id
    LEFT JOIN social_planner_asana_project_mappings m
      ON m.hotel_id = u.hotel_id AND m.planner_user_id = ?
    ORDER BY u.sort_order`, [userId]);
}

async function listWorkspaceProjects(fetchImpl, token, workspaceGid) {
  return paginatedAsana(fetchImpl, `${ASANA_API}/workspaces/${encodeURIComponent(workspaceGid)}/projects?archived=false&limit=100&opt_fields=gid,name,permalink_url`, token, 5);
}

async function listProjectTasks(fetchImpl, token, projectGid, completedSince) {
  const fields = "gid,name,completed,due_on,due_at,start_on,start_at,permalink_url,assignee.name,memberships.project.gid,memberships.section.name";
  return paginatedAsana(fetchImpl, `${ASANA_API}/projects/${encodeURIComponent(projectGid)}/tasks?limit=100&completed_since=${encodeURIComponent(`${completedSince}T00:00:00Z`)}&opt_fields=${encodeURIComponent(fields)}`, token, 5);
}

async function fetchAsanaTask(fetchImpl, token, taskGid) {
  const gid = String(taskGid || "").trim();
  if (!/^\d+$/u.test(gid)) throw badRequest("Tarefa do Asana inválida.");
  const payload = await asanaJsonRequest(fetchImpl, `${ASANA_API}/tasks/${encodeURIComponent(gid)}?opt_fields=${encodeURIComponent(taskFields())}`, token);
  if (!payload.data) throw badRequest("Tarefa do Asana não encontrada.");
  return payload.data;
}

function taskFields() {
  return "gid,name,notes,completed,completed_at,due_on,due_at,start_on,start_at,modified_at,permalink_url,assignee.gid,assignee.name,memberships.project.gid,memberships.project.name,memberships.section.name";
}

async function requireMappedTask(env, userId, task) {
  const mappings = await unitMappings(env, userId);
  const byProject = new Map(mappings.filter((mapping) => mapping.project_gid).map((mapping) => [mapping.project_gid, mapping]));
  const membership = (task.memberships || []).find((entry) => byProject.has(entry.project?.gid));
  if (!membership) throw unauthorized("Essa tarefa não pertence a um projeto vinculado neste Planner.");
  return { ...byProject.get(membership.project.gid), section_name: membership.section?.name || null };
}

function publicTask(task, mapping) {
  const startDate = task.start_on || task.start_at?.slice(0, 10) || task.due_on || task.due_at?.slice(0, 10) || null;
  const endDate = task.due_on || task.due_at?.slice(0, 10) || startDate;
  return {
    gid: task.gid,
    name: task.name || "",
    notes: task.notes || "",
    completed: Boolean(task.completed),
    completed_at: task.completed_at || null,
    start_date: startDate,
    end_date: endDate,
    start_on: task.start_on || null,
    due_on: task.due_on || null,
    due_at: task.due_at || null,
    has_start_date: Boolean(task.start_on || task.start_at),
    modified_at: task.modified_at || null,
    permalink_url: task.permalink_url || null,
    assignee_gid: task.assignee?.gid || null,
    assignee_name: task.assignee?.name || null,
    section_name: mapping.section_name,
    hotel_id: mapping.hotel_id,
    hotel_name: mapping.hotel_name,
    project_gid: mapping.project_gid,
    project_name: mapping.project_name,
  };
}

function taskUpdateInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const data = {};
  if (Object.hasOwn(source, "name")) {
    const name = String(source.name || "").trim();
    if (!name || name.length > 500) throw badRequest("Informe um título de até 500 caracteres.");
    data.name = name;
  }
  if (Object.hasOwn(source, "notes")) {
    const notes = String(source.notes || "");
    if (notes.length > 50_000) throw badRequest("A descrição da tarefa está muito longa.");
    data.notes = notes;
  }
  if (Object.hasOwn(source, "completed")) data.completed = Boolean(source.completed);
  const hasStart = Object.hasOwn(source, "start_on");
  const hasDue = Object.hasOwn(source, "due_on");
  if (hasStart || hasDue) {
    const startOn = source.start_on == null || source.start_on === "" ? null : String(source.start_on);
    const dueOn = source.due_on == null || source.due_on === "" ? null : String(source.due_on);
    if (startOn && !ISO_DATE.test(startOn)) throw badRequest("Data inicial inválida.");
    if (dueOn && !ISO_DATE.test(dueOn)) throw badRequest("Data final inválida.");
    if (startOn && !dueOn) throw badRequest("Informe a data final quando houver data inicial.");
    if (startOn && dueOn && startOn > dueOn) throw badRequest("A data final deve ser igual ou posterior à inicial.");
    if (hasDue) data.due_on = dueOn;
    if (hasStart) data.start_on = startOn;
  }
  return data;
}

async function paginatedAsana(fetchImpl, initialUrl, token, maxPages) {
  const records = [];
  let url = initialUrl;
  for (let page = 0; url && page < maxPages; page += 1) {
    const payload = await asanaJsonRequest(fetchImpl, url, token);
    records.push(...(payload.data || []));
    url = payload.next_page?.uri || null;
  }
  return records;
}

async function requireConnection(env, userId) {
  requireAsanaConfiguration(env);
  const connection = await connectionRow(env, userId);
  if (!connection || connection.status !== "active") throw unauthorized("Conecte sua conta do Asana para continuar.");
  return connection;
}

async function connectionRow(env, userId) {
  return first(env, `SELECT planner_user_id, provider_account_id, account_name, account_email,
      workspace_gid, workspace_name, access_token_encrypted, refresh_token_encrypted,
      access_token_expires_at, granted_scope, status, connected_at, updated_at,
      last_sync_at, last_error
    FROM social_planner_asana_connections WHERE planner_user_id = ?`, [userId]);
}

function publicConnection(row) {
  return {
    account_name: row.account_name, account_email: row.account_email,
    workspace_gid: row.workspace_gid, workspace_name: row.workspace_name,
    status: row.status, connected_at: row.connected_at, updated_at: row.updated_at,
    last_sync_at: row.last_sync_at, last_error: row.last_error,
  };
}

function plannerUserId(session) {
  const id = session?.user?.planner_user_id;
  if (!id) throw unauthorized("Usuário do Planner não identificado.");
  return id;
}

function asanaConfigured(env) {
  return Boolean(env?.ASANA_CLIENT_ID && env?.ASANA_CLIENT_SECRET && env?.ASANA_TOKEN_KEY);
}

function requireAsanaConfiguration(env) {
  if (!asanaConfigured(env)) throw badRequest("A integração com o Asana ainda não foi configurada neste ambiente.");
}

async function validAccessToken(env, connection, fetchImpl) {
  if (connection.status === "reauthorization_required") throw unauthorized("Reconecte sua conta do Asana.");
  if (connection.access_token_encrypted && Date.parse(connection.access_token_expires_at || "") > Date.now() + 60_000) {
    return decryptSecret(env, connection.access_token_encrypted);
  }
  if (!connection.refresh_token_encrypted) throw unauthorized("Reconecte sua conta do Asana.");
  try {
    const tokens = await asanaFormRequest(fetchImpl, ASANA_TOKEN_URL, {
      grant_type: "refresh_token",
      client_id: env.ASANA_CLIENT_ID,
      client_secret: env.ASANA_CLIENT_SECRET,
      refresh_token: await decryptSecret(env, connection.refresh_token_encrypted),
    });
    const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();
    const refreshToken = tokens.refresh_token
      ? await encryptSecret(env, tokens.refresh_token)
      : connection.refresh_token_encrypted;
    await run(env, `UPDATE social_planner_asana_connections SET access_token_encrypted = ?,
      refresh_token_encrypted = ?, access_token_expires_at = ?, status = 'active',
      updated_at = ?, last_error = NULL WHERE planner_user_id = ?`, [
      await encryptSecret(env, tokens.access_token), refreshToken, expiresAt, new Date().toISOString(), connection.planner_user_id,
    ]);
    return tokens.access_token;
  } catch (error) {
    await run(env, `UPDATE social_planner_asana_connections SET status = 'reauthorization_required',
      last_error = ?, updated_at = ? WHERE planner_user_id = ?`, [
      String(error?.message || "Token expirado.").slice(0, 500), new Date().toISOString(), connection.planner_user_id,
    ]);
    throw error;
  }
}

async function asanaFormRequest(fetchImpl, url, body) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || payload.errors?.[0]?.message || `Asana respondeu ${response.status}.`);
  return payload;
}

async function asanaJsonRequest(fetchImpl, url, token, options = {}) {
  const response = await fetchImpl(url, {
    method: options.method || "GET",
    headers: { accept: "application/json", authorization: `Bearer ${token}`, ...(options.body ? { "content-type": "application/json" } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.errors?.[0]?.message || `Asana respondeu ${response.status}.`);
  return payload;
}

function hasGrantedScope(connection, scope) {
  return String(connection?.granted_scope || "").split(/\s+/u).includes(scope);
}

async function encryptSecret(env, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(env), new TextEncoder().encode(value));
  return `v1.${base64Url(iv)}.${base64Url(encrypted)}`;
}

async function decryptSecret(env, value) {
  const [version, iv, encrypted] = String(value || "").split(".");
  if (version !== "v1" || !iv || !encrypted) throw unauthorized("Credencial do Asana inválida.");
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(iv) }, await encryptionKey(env), fromBase64Url(encrypted));
  return new TextDecoder().decode(plaintext);
}

async function encryptionKey(env) {
  requireAsanaConfiguration(env);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.ASANA_TOKEN_KEY));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function normalizeName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/gu, "").trim().toLocaleLowerCase("pt-BR");
}
function oauthOrigin(request, env) {
  const requestUrl = new URL(request.url);
  if (["localhost", "127.0.0.1"].includes(requestUrl.hostname)) return requestUrl.origin;
  return String(env.GUEST_PORTAL_PUBLIC_ORIGIN || requestUrl.origin).replace(/\/$/u, "");
}
function randomToken(size) { return base64Url(crypto.getRandomValues(new Uint8Array(size))); }
async function sha256Hex(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function base64Url(value) {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
function fromBase64Url(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
