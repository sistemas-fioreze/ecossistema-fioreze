"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const STATUS_MAX_AGE_MS = 20_000;

function localAppData(env = process.env) {
  return env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
}

function suitePaths(env = process.env) {
  const base = path.join(localAppData(env), "Fioreze");
  return {
    configFile: path.join(base, "Suite", "erp-config.json"),
    iconFile: path.join(base, "Suite", "unidade.ico"),
    suiteExecutable: path.join(base, "Suite", "Fioreze-Suite.exe"),
    agentConfigFile: path.join(base, "PrintAgent", "config.json"),
    agentStatusFile: path.join(base, "PrintAgent", "runtime-status.json"),
    restartRequestFile: path.join(base, "PrintAgent", "restart.request"),
  };
}

function readErpConfiguration({ env = process.env, fileSystem = fs } = {}) {
  const configuredUrl = String(env.FIOREZE_ROOM_SERVICE_ERP_URL || "").trim();
  if (configuredUrl) return { url: configuredUrl, source: "environment" };

  const { configFile } = suitePaths(env);
  try {
    const config = JSON.parse(fileSystem.readFileSync(configFile, "utf8"));
    const origin = String(config.origin || "").replace(/\/+$/, "");
    const hotelSlug = normalizeSlug(config.hotel_slug);
    if (origin && hotelSlug) {
      return {
        url: `${origin}/${hotelSlug}/admin/erp/`,
        hotelSlug,
        hotelName: cleanText(config.hotel_name, 120),
        source: "installed-config",
      };
    }
  } catch {
    // A missing or malformed local configuration falls back to the public entry.
  }

  return { url: null, source: "unconfigured" };
}

function readPrintAgentStatus({ env = process.env, fileSystem = fs, now = Date.now() } = {}) {
  const paths = suitePaths(env);
  const installed = fileSystem.existsSync(paths.suiteExecutable);
  const configuration = readAgentConfiguration(paths.agentConfigFile, fileSystem);
  const configured = Boolean(configuration.hotel_id && configuration.device_id && configuration.protected_token);
  let payload = {};
  try {
    payload = JSON.parse(fileSystem.readFileSync(paths.agentStatusFile, "utf8"));
  } catch {
    payload = {};
  }

  const updatedAt = parseTimestamp(payload.updated_at);
  const fresh = Boolean(updatedAt && now - updatedAt <= STATUS_MAX_AGE_MS);
  const running = configured && fresh && ["starting", "running", "restarting"].includes(payload.status);
  return {
    installed,
    configured,
    running,
    status: running ? payload.status : !configured ? "not_configured" : installed ? "offline" : "not_installed",
    message: running
      ? cleanText(payload.message, 180)
      : !configured
        ? "Este computador usa somente o ERP"
        : installed
          ? "Servidor de impressao sem resposta"
          : "Fioreze Suite nao instalado",
    updated_at: updatedAt ? new Date(updatedAt).toISOString() : null,
    hotel_id: cleanIdentifier(payload.hotel_id || configuration.hotel_id),
    device_id: cleanIdentifier(payload.device_id || configuration.device_id),
    device_name: cleanText(payload.device_name || configuration.device_name, 120),
    printer_name: cleanText(payload.printer_name || configuration.printer_name, 160),
    app_version: cleanText(payload.app_version, 32),
  };
}

function restartPrintAgent({ env = process.env, fileSystem = fs, spawnProcess = spawn, now = new Date() } = {}) {
  const paths = suitePaths(env);
  const status = readPrintAgentStatus({ env, fileSystem, now: now.getTime() });
  if (!status.configured) {
    return { ok: false, action: "not_configured", status };
  }
  if (!status.installed) {
    return { ok: false, action: "not_installed", status };
  }

  fileSystem.mkdirSync(path.dirname(paths.restartRequestFile), { recursive: true });
  if (status.running) {
    writeAtomic(fileSystem, paths.restartRequestFile, JSON.stringify({ requested_at: now.toISOString() }));
    return { ok: true, action: "restart_requested", status };
  }

  try {
    fileSystem.rmSync(paths.restartRequestFile, { force: true });
    const child = spawnProcess(paths.suiteExecutable, ["--tray"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      shell: false,
    });
    child.unref();
    return { ok: true, action: "started", status };
  } catch {
    return { ok: false, action: "start_failed", status };
  }
}

function readAgentConfiguration(target, fileSystem) {
  try {
    const payload = JSON.parse(fileSystem.readFileSync(target, "utf8"));
    return {
      hotel_id: cleanIdentifier(payload.hotel_id),
      device_id: cleanIdentifier(payload.device_id),
      device_name: cleanText(payload.device_name, 120),
      printer_name: cleanText(payload.printer_name, 160),
      protected_token: typeof payload.protected_token === "string" && payload.protected_token.trim() ? true : false,
    };
  } catch {
    return {};
  }
}

function writeAtomic(fileSystem, target, content) {
  const temporary = `${target}.tmp`;
  fileSystem.writeFileSync(temporary, content, { encoding: "utf8", mode: 0o600 });
  fileSystem.renameSync(temporary, target);
}

function normalizeSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : "";
}

function cleanIdentifier(value) {
  const identifier = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{1,128}$/.test(identifier) ? identifier : "";
}

function cleanText(value, maximum) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maximum);
}

function parseTimestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

module.exports = {
  STATUS_MAX_AGE_MS,
  readErpConfiguration,
  readPrintAgentStatus,
  restartPrintAgent,
  suitePaths,
};
