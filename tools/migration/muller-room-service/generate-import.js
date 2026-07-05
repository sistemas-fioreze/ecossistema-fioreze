#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs, arrayArg, stringArg } from "./lib/args.js";
import { normalizeCatalog } from "./lib/catalog.js";
import { auditData } from "./lib/data-quality.js";
import { fileSha256 } from "./lib/hash.js";
import { buildImportPlan } from "./lib/import-plan.js";
import { normalizeOrders } from "./lib/orders.js";
import { ensureOutputDir, writeJson } from "./lib/paths.js";
import { readTabularFile } from "./lib/spreadsheet.js";

const args = parseArgs();
if (!args["dry-run"]) throw new Error("Por seguranca, use --dry-run. Esta ferramenta nao escreve no D1.");
const spreadsheets = arrayArg(args.spreadsheet);
if (!spreadsheets.length) throw new Error("Informe ao menos um --spreadsheet.");

const hotelId = stringArg(args.hotel, "muller-fioreze");
const moduleKey = stringArg(args.module, "room-service");
const outputDir = await ensureOutputDir(stringArg(args.output, "local-output/muller"));
const workbooks = [];
const inputHashes = [];
for (const spreadsheet of spreadsheets) {
  workbooks.push(await readTabularFile(spreadsheet));
  inputHashes.push({ file_name: path.basename(spreadsheet), sha256: await fileSha256(spreadsheet) });
}

const catalogData = normalizeCatalog(workbooks, { hotelId, moduleKey });
const orderData = normalizeOrders(workbooks, { hotelId, moduleKey });
const audit = auditData({ workbooks, catalogData, orderData });
const plan = buildImportPlan({ catalogData, hotelId, moduleKey, inputHashes });

await writeJson(path.join(outputDir, "catalog.normalized.json"), catalogData);
await writeJson(path.join(outputDir, "orders.anonymized.json"), orderData);
await writeJson(path.join(outputDir, "validation-report.json"), audit);
await fs.writeFile(path.join(outputDir, "import-preview.sql"), `${plan.sql_preview}\n`, "utf8");
await writeJson(path.join(outputDir, "import-preview.parameters.json"), plan.parameters);

console.log(JSON.stringify({
  mode: "dry-run",
  output_dir: outputDir,
  summary: plan.summary,
  validation: {
    invalid_prices: audit.invalid_prices,
    products_without_name: audit.products_without_name,
    products_without_price: audit.products_without_price,
    duplicate_names: audit.duplicate_names,
  },
}, null, 2));
