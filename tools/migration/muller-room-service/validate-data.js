#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs, arrayArg, stringArg } from "./lib/args.js";
import { analyzeAppsScript } from "./lib/apps-script.js";
import { normalizeCatalog } from "./lib/catalog.js";
import { auditData } from "./lib/data-quality.js";
import { normalizeOrders } from "./lib/orders.js";
import { ensureOutputDir, writeJson } from "./lib/paths.js";
import { readTabularFile } from "./lib/spreadsheet.js";

const args = parseArgs();
const spreadsheets = arrayArg(args.spreadsheet);
const appScript = stringArg(args["apps-script"]);
if (!spreadsheets.length && !appScript) throw new Error("Informe --spreadsheet e/ou --apps-script.");

const outputDir = await ensureOutputDir(stringArg(args.output, "local-output/muller"));
const workbooks = [];
for (const spreadsheet of spreadsheets) workbooks.push(await readTabularFile(spreadsheet));

const catalogData = normalizeCatalog(workbooks, { hotelId: stringArg(args.hotel, "muller-fioreze"), moduleKey: stringArg(args.module, "room-service") });
const orderData = normalizeOrders(workbooks, { hotelId: stringArg(args.hotel, "muller-fioreze"), moduleKey: stringArg(args.module, "room-service") });
const textFiles = [];
if (appScript) textFiles.push({ path: appScript, content: await fs.readFile(appScript, "utf8"), analysis: await analyzeAppsScript(appScript) });

const audit = auditData({ workbooks, catalogData, orderData, textFiles });
await writeJson(path.join(outputDir, "data-audit.json"), audit);
await writeJson(path.join(outputDir, "validation-report.json"), audit);
console.log(JSON.stringify({
  output: path.join(outputDir, "data-audit.json"),
  products_found: audit.products_found,
  categories_found: audit.categories_found,
  orders_found: audit.orders_found,
  invalid_prices: audit.invalid_prices,
  personal_or_secret_categories: [...new Set([
    ...audit.workbook_sheets.flatMap((sheet) => sheet.sensitive_categories),
    ...audit.text_file_sensitive_categories.flatMap((file) => file.categories),
  ])].length,
}, null, 2));
