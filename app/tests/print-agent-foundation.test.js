import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createEnrollmentCode, createPrintAgentToken, sha256Hex } from "../src/services/print-agent-auth.js";
import { ADMIN_ORIGIN, createSessionCookie, withCookie } from "./helpers/admin-session.js";
import { createWorkerTestContext } from "./helpers/worker.js";

const migrationUrl = new URL("../migrations/0038_print_agent_foundation.sql", import.meta.url);
const centroTemplateUrl = new URL("../migrations/0042_fioreze_centro_print_template.sql", import.meta.url);
const routesUrl = new URL("../src/modules/print-agent/routes.js", import.meta.url);
const serviceUrl = new URL("../src/modules/print-agent/service.js", import.meta.url);
const agentUrl = new URL("../print-agent/fioreze_print_agent/worker.py", import.meta.url);
const appUrl = new URL("../print-agent/fioreze_print_agent/app.py", import.meta.url);
const trayUrl = new URL("../print-agent/fioreze_print_agent/tray.py", import.meta.url);
const updaterUrl = new URL("../print-agent/fioreze_print_agent/updater.py", import.meta.url);
const buildUrl = new URL("../print-agent/build-windows.ps1", import.meta.url);
const erpAppUrl = new URL("../public/js/modules/room-service-erp/legacy-app.js", import.meta.url);

test("migration cria fila segura, dispositivos e templates por unidade", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS printer_templates/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS printer_devices/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS printer_enrollment_codes/i);
  assert.match(sql, /uq_print_events_request_key/i);
  assert.match(sql, /legacy-thermal-42/i);
  assert.match(sql, /room-service\.printing_enabled/i);
});

test("API do agente possui vinculo, heartbeat, claim e confirmacao", async () => {
  const routes = await readFile(routesUrl, "utf8");
  for (const path of ["enrollment/hotels", "/enroll", "/heartbeat", "/settings", "/jobs/claim", "/complete", "/fail"]) {
    assert.ok(routes.includes(path), `rota ausente: ${path}`);
  }
});

test("Fioreze Centro recebe template Elgin proprio sem alterar o template generico", async () => {
  const sql = await readFile(centroTemplateUrl, "utf8");
  assert.match(sql, /fiorezecentro/i);
  assert.match(sql, /legacy-centro-elgin-48/i);
  assert.match(sql, /paper_columns\"\s*:\s*48/i);
  assert.match(sql, /VIA COZINHA\/RECEP/i);
  assert.match(sql, /ON CONFLICT\(hotel_id, module_key, template_key\)/i);
  assert.doesNotMatch(sql, /script\.google|spreadsheets|private_key|printer_name/i);
});

test("claim e confirmacao permanecem isolados por hotel e usam operacoes condicionais", async () => {
  const source = await readFile(serviceUrl, "utf8");
  assert.match(source, /pe\.hotel_id = \?/);
  assert.match(source, /status = 'queued'/);
  assert.match(source, /claim_token_hash = \?/);
  assert.match(source, /status = 'printing'/);
  assert.match(source, /pe\.claim_token_hash = \?/);
  assert.match(source, /SET claim_token_hash = NULL/);
  assert.match(source, /NOT EXISTS \(SELECT 1 FROM order_status_history/i);
});

test("falha transitoria retorna a fila e limita novas tentativas", async () => {
  const source = await readFile(serviceUrl, "utf8");
  assert.match(source, /CASE WHEN attempts < 3 THEN 'queued' ELSE 'failed' END/i);
  assert.match(source, /device_id = CASE WHEN attempts < 3 THEN NULL/i);
});

test("agente local nao contem dependencias do legado", async () => {
  const source = await readFile(agentUrl, "utf8");
  assert.doesNotMatch(source, /gspread|google sheets|apps script/i);
});

test("unidade fornece logo reduzida e agente preserva selecao de impressora e bandeja", async () => {
  const [service, app, tray] = await Promise.all([
    readFile(serviceUrl, "utf8"),
    readFile(appUrl, "utf8"),
    readFile(trayUrl, "utf8"),
  ]);
  assert.match(service, /COALESCE\(hb\.icon_url, hb\.logo_url\) AS icon_url/i);
  assert.match(app, /list_printers\(\)/);
  assert.match(app, /_button\(settings_actions, "Salvar"/);
  assert.match(app, /load_unit_tray_icon/);
  assert.match(tray, /pystray\.Icon/);
  assert.match(tray, /MenuItem\("Abrir painel"/);
  assert.match(tray, /MenuItem\("Abrir ERP"/);
  assert.match(tray, /MenuItem\("Verificar atualizacoes"/);
  assert.match(tray, /MenuItem\("Atualizar agora"/);
  assert.match(tray, /MenuItem\("Reiniciar agente"/);
  assert.match(tray, /MenuItem\("Sair"/);
  assert.match(app, /schedule_midnight_update_check/);
  assert.match(app, /mode="automatic"/);
  assert.match(app, /AUTO_UPDATE_RETRY_MS\s*=\s*15 \* 60 \* 1000/);
});

test("build Windows gera pacote separado sem configuracao ou credencial", async () => {
  const [source, updater] = await Promise.all([
    readFile(buildUrl, "utf8"),
    readFile(updaterUrl, "utf8"),
  ]);
  assert.match(source, /Fioreze-Suite-Windows/);
  assert.match(source, /Fioreze-Suite-Windows\.zip/i);
  assert.match(source, /Print-Agent-Updater/);
  assert.match(source, /latest\.json/);
  assert.match(source, /SHA256SUMS\.txt/i);
  assert.doesNotMatch(source, /Copy-Item[^\n]*(config\.json|token|credential)/i);
  assert.match(updater, /downloads\/print-agent/);
  assert.match(updater, /sha256/i);
  assert.match(updater, /auto|download/i);
  assert.doesNotMatch(updater, /cookie|password|secret/i);
});

test("build Windows valida o runtime Python e nao depende de caminho de usuario", async () => {
  const source = await readFile(buildUrl, "utf8");
  assert.match(source, /Test-Path -LiteralPath \$env:FIOREZE_PYTHON/);
  assert.match(source, /Get-Command python/);
  assert.match(source, /Remove-Item \$Venv -Recurse -Force/);
  assert.doesNotMatch(source, /C:\\\\Users\\\\(?:Marketing|wesle)/i);
});

test("agente permite escolher template e ERP exibe estado real de conexao", async () => {
  const [service, app, erp] = await Promise.all([
    readFile(serviceUrl, "utf8"),
    readFile(appUrl, "utf8"),
    readFile(erpAppUrl, "utf8"),
  ]);
  assert.match(service, /updatePrintAgentSettings/);
  assert.match(service, /template_id = \?/);
  assert.match(service, /hotel_id = \? AND module_key = \?/);
  assert.match(app, /Modelo do comprovante/);
  assert.match(app, /Imprimir teste/);
  assert.match(app, /overrideredirect\(True\)/);
  assert.match(app, /status_window_geometry\(work_area_bounds\(self\.root\)\)/);
  assert.match(app, /resizable\(False, False\)/);
  assert.match(erp, /connection_status/);
  assert.match(erp, /Online/);
  assert.match(erp, /Offline/);
});

test("ERP formata validade do codigo e atividade dos dispositivos com helper existente", async () => {
  const source = await readFile(erpAppUrl, "utf8");
  assert.match(source, /Expira em \$\{escapeHtml\(formatDate\(activation\.expires_at\)\)\}/);
  assert.match(source, /formatDate\(device\.last_seen_at\)/);
  assert.doesNotMatch(source, /formatDateTime\(/);
});

test("tokens e codigos de vinculo possuem entropia e somente hashes persistiveis", async () => {
  const tokenA = createPrintAgentToken();
  const tokenB = createPrintAgentToken();
  const code = createEnrollmentCode();
  assert.notEqual(tokenA, tokenB);
  assert.ok(tokenA.length >= 40);
  assert.match(code, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  assert.match(await sha256Hex(tokenA), /^[a-f0-9]{64}$/);
});

test("ERP permite somente um servidor de impressao conectado por unidade", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  const enrollment = await json(
    "/api/v1/admin/room-service/printing/enrollment-codes",
    adminJson(cookie, "POST", { hotel_id: "muller-fioreze" }),
  );
  const activationCode = enrollment.body.data.activation_code;

  const [firstEnrollment, concurrentEnrollment] = await Promise.all([
    json("/api/v1/print-agent/enroll", agentEnrollment(activationCode, "Servidor principal")),
    json("/api/v1/print-agent/enroll", agentEnrollment(activationCode, "Servidor concorrente")),
  ]);
  const statuses = [firstEnrollment.response.status, concurrentEnrollment.response.status].sort((a, b) => a - b);
  const blockedCode = await json(
    "/api/v1/admin/room-service/printing/enrollment-codes",
    adminJson(cookie, "POST", { hotel_id: "muller-fioreze" }),
  );

  assert.deepEqual(statuses, [201, 409]);
  assert.equal(env.__data.printerDevices.filter((device) => device.status !== "revoked").length, 1);
  assert.equal(blockedCode.response.status, 409);
  assert.match(blockedCode.body.error.message, /revogue o computador/i);
});

test("computador pausado ocupa a vaga e somente o revogado pode ser excluido", async () => {
  const { env, json } = createWorkerTestContext();
  const cookie = await createSessionCookie(env);
  env.__data.printerDevices.push(printerDevice({ id: "printer-test-active", status: "active" }));
  env.__data.printEvents.push({
    id: "print-event-device-history",
    hotel_id: "muller-fioreze",
    module_key: "room-service",
    device_id: "printer-test-active",
    status: "printed",
  });

  const rejectedDelete = await json(
    "/api/v1/admin/room-service/printing/devices/printer-test-active",
    adminJson(cookie, "DELETE", { hotel_id: "muller-fioreze" }),
  );
  const paused = await json(
    "/api/v1/admin/room-service/printing/devices/printer-test-active",
    adminJson(cookie, "PATCH", { hotel_id: "muller-fioreze", status: "paused" }),
  );
  const blockedWhilePaused = await json(
    "/api/v1/admin/room-service/printing/enrollment-codes",
    adminJson(cookie, "POST", { hotel_id: "muller-fioreze" }),
  );
  const revoked = await json(
    "/api/v1/admin/room-service/printing/devices/printer-test-active",
    adminJson(cookie, "PATCH", { hotel_id: "muller-fioreze", status: "revoked" }),
  );
  const printing = await json(
    "/api/v1/admin/room-service/printing?hotel_id=muller-fioreze",
    withCookie(cookie),
  );
  const removed = await json(
    "/api/v1/admin/room-service/printing/devices/printer-test-active",
    adminJson(cookie, "DELETE", { hotel_id: "muller-fioreze" }),
  );

  assert.equal(rejectedDelete.response.status, 409);
  assert.equal(paused.response.status, 200);
  assert.equal(blockedWhilePaused.response.status, 409);
  assert.equal(revoked.response.status, 200);
  assert.equal(printing.body.data.can_create_enrollment, true);
  assert.equal(removed.response.status, 200);
  assert.equal(env.__data.printerDevices.length, 0);
  assert.equal(env.__data.printEvents[0].device_id, null);
  assert.ok(env.__data.adminAuditLog.some((entry) => entry.action === "room-service.printer.device.deleted"));
});

test("migration garante uma unica conexao ativa ou pausada por hotel", async () => {
  const sql = await readFile(new URL("../migrations/0046_single_print_server_per_hotel.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS uq_printer_devices_single_connected/i);
  assert.match(sql, /ON printer_devices\(hotel_id, module_key\)/i);
  assert.match(sql, /WHERE status IN \('active', 'paused'\)/i);
});

function adminJson(cookie, method, body) {
  return withCookie(cookie, {
    method,
    headers: {
      "content-type": "application/json",
      "x-fioreze-admin-action": "erp-admin",
      origin: ADMIN_ORIGIN,
    },
    body: JSON.stringify(body),
  });
}

function agentEnrollment(activationCode, deviceName) {
  return {
    method: "POST",
    headers: { "content-type": "application/json", "x-fioreze-test-now": "2026-07-12T12:00:00.000Z" },
    body: JSON.stringify({
      hotel_id: "muller-fioreze",
      activation_code: activationCode,
      device_name: deviceName,
      platform: "windows",
      app_version: "1.0.0-test",
      printer_name: "Impressora ficticia",
    }),
  };
}

function printerDevice({ id, status }) {
  return {
    id,
    hotel_id: "muller-fioreze",
    module_key: "room-service",
    name: "Servidor ficticio",
    token_hash: `hash-${id}`,
    platform: "windows",
    app_version: "1.0.0-test",
    printer_name: "Impressora ficticia",
    template_id: "print-template-muller-default",
    status,
    created_at: "2026-07-12T10:00:00.000Z",
    updated_at: "2026-07-12T10:00:00.000Z",
    last_seen_at: "2026-07-12T11:59:30.000Z",
    revoked_at: null,
  };
}
