import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createEnrollmentCode, createPrintAgentToken, sha256Hex } from "../src/services/print-agent-auth.js";

const migrationUrl = new URL("../migrations/0038_print_agent_foundation.sql", import.meta.url);
const routesUrl = new URL("../src/modules/print-agent/routes.js", import.meta.url);
const serviceUrl = new URL("../src/modules/print-agent/service.js", import.meta.url);
const agentUrl = new URL("../print-agent/fioreze_print_agent/worker.py", import.meta.url);
const appUrl = new URL("../print-agent/fioreze_print_agent/app.py", import.meta.url);
const trayUrl = new URL("../print-agent/fioreze_print_agent/tray.py", import.meta.url);
const buildUrl = new URL("../print-agent/build-windows.ps1", import.meta.url);

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
  for (const path of ["enrollment/hotels", "/enroll", "/heartbeat", "/jobs/claim", "/complete", "/fail"]) {
    assert.ok(routes.includes(path), `rota ausente: ${path}`);
  }
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
  assert.match(app, /Salvar impressora/);
  assert.match(app, /load_unit_tray_icon/);
  assert.match(tray, /pystray\.Icon/);
  assert.match(tray, /MenuItem\("Abrir"/);
  assert.match(tray, /MenuItem\("Sair"/);
});

test("build Windows gera pacote separado sem configuracao ou credencial", async () => {
  const source = await readFile(buildUrl, "utf8");
  assert.match(source, /Fioreze-Impressao-Windows/);
  assert.match(source, /Fioreze-Impressao-Windows\.zip/i);
  assert.match(source, /SHA256SUMS\.txt/i);
  assert.doesNotMatch(source, /Copy-Item[^\n]*(config\.json|token|credential)/i);
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
