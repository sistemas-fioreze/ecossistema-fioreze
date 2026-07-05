#!/usr/bin/env node
import path from "node:path";
import { parseArgs, arrayArg, stringArg } from "./lib/args.js";
import { normalizeCatalog } from "./lib/catalog.js";
import { ensureOutputDir, writeJson } from "./lib/paths.js";
import { readTabularFile } from "./lib/spreadsheet.js";

const args = parseArgs();
const spreadsheets = arrayArg(args.spreadsheet);
if (!spreadsheets.length) throw new Error("Informe ao menos um --spreadsheet.");

const outputDir = await ensureOutputDir(stringArg(args.output, "local-output/muller"));
const workbooks = [];
for (const spreadsheet of spreadsheets) workbooks.push(await readTabularFile(spreadsheet));

const catalog = normalizeCatalog(workbooks, {
  hotelId: stringArg(args.hotel, "muller-fioreze"),
  moduleKey: stringArg(args.module, "room-service"),
});

await writeJson(path.join(outputDir, "catalog.normalized.json"), catalog);
console.log(JSON.stringify({
  output: path.join(outputDir, "catalog.normalized.json"),
  categories: catalog.categories.length,
  products: catalog.items.length,
  ignored_rows: catalog.ignored_rows.length,
}, null, 2));
