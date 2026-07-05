import fs from "node:fs/promises";
import path from "node:path";
import { scanTextForSensitive } from "./privacy.js";

export async function analyzeAppsScript(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return analyzeAppsScriptText(content, filePath);
}

export function analyzeAppsScriptText(content, filePath = "apps-script.txt") {
  const functions = [...content.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g)].map((match) => ({
    name: match[1],
    params: match[2].split(",").map((param) => param.trim()).filter(Boolean),
    public_like: /^(doGet|doPost|api|handle|process|get|save|update|delete|print|imprimir)/i.test(match[1]),
  }));
  const serviceFlags = {
    spreadsheet: /SpreadsheetApp/.test(content),
    content_service: /ContentService/.test(content),
    lock_service: /LockService/.test(content),
    cache_service: /CacheService/.test(content),
    properties_service: /PropertiesService/.test(content),
    url_fetch: /UrlFetchApp/.test(content),
    triggers: /ScriptApp|newTrigger|onOpen|onEdit/i.test(content),
  };
  const sheetNames = unique([...content.matchAll(/getSheetByName\((['"`])([\s\S]*?)\1\)/g)].map((match) => match[2]));
  const externalDomains = unique([...content.matchAll(/https?:\/\/([^/"')\s]+)/g)].map((match) => match[1]));
  const parameters = unique([
    ...[...content.matchAll(/(?:e\.parameter|parameter)\.([A-Za-z0-9_]+)/g)].map((match) => match[1]),
    ...[...content.matchAll(/payload\.([A-Za-z0-9_]+)/g)].map((match) => match[1]),
  ]);
  const behaviors = [
    behavior("Recebe requisicoes GET", /function\s+doGet\b/.test(content), "deve ser preservado"),
    behavior("Recebe requisicoes POST", /function\s+doPost\b/.test(content), "deve ser preservado"),
    behavior("Le planilhas", serviceFlags.spreadsheet, "precisa ser reimplementado"),
    behavior("Grava pedidos", /appendRow|setValues|getRange\([^)]*\)\.set/i.test(content), "ja existe parcialmente na nova plataforma"),
    behavior("Usa locks", serviceFlags.lock_service, "deve ser preservado conceitualmente"),
    behavior("Usa cache", serviceFlags.cache_service, "precisa de decisao humana"),
    behavior("Usa propriedades do script", serviceFlags.properties_service, "nao deve ser migrado com valores reais"),
    behavior("Chama URL externa", serviceFlags.url_fetch, "precisa de decisao humana"),
    behavior("Aciona impressao", /impress|print|printer/i.test(content), "nao deve ser migrado nesta fase"),
    behavior("Calcula totais", /total|subtotal|preco|valor/i.test(content), "ja existe parcialmente na nova plataforma"),
    behavior("Controla horarios", /horario|aberto|fechado|funcionamento|store/i.test(content), "ja existe parcialmente na nova plataforma"),
  ].filter(Boolean);

  return {
    file: filePath,
    file_name: path.basename(filePath),
    function_count: functions.length,
    functions,
    do_get: functions.some((item) => item.name === "doGet"),
    do_post: functions.some((item) => item.name === "doPost"),
    services: serviceFlags,
    sheet_names: sheetNames,
    external_domains: externalDomains,
    parameters,
    behavior_classification: behaviors,
    sensitive_categories: scanTextForSensitive(content),
  };
}

function behavior(name, present, classification) {
  return present ? { name, classification } : null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}
