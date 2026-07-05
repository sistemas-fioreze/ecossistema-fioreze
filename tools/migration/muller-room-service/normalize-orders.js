#!/usr/bin/env node
import path from "node:path";
import { parseArgs, arrayArg, stringArg } from "./lib/args.js";
import { normalizeOrders } from "./lib/orders.js";
import { ensureOutputDir, writeJson } from "./lib/paths.js";
import { readTabularFile } from "./lib/spreadsheet.js";

const args = parseArgs();
const spreadsheets = arrayArg(args.spreadsheet);
if (!spreadsheets.length) throw new Error("Informe ao menos um --spreadsheet.");

const outputDir = await ensureOutputDir(stringArg(args.output, "local-output/muller"));
const workbooks = [];
for (const spreadsheet of spreadsheets) workbooks.push(await readTabularFile(spreadsheet));

const orders = normalizeOrders(workbooks, {
  hotelId: stringArg(args.hotel, "muller-fioreze"),
  moduleKey: stringArg(args.module, "room-service"),
});

await writeJson(path.join(outputDir, "orders.anonymized.json"), orders);
console.log(JSON.stringify({
  output: path.join(outputDir, "orders.anonymized.json"),
  orders: orders.orders.length,
  ignored_rows: orders.ignored_rows.length,
}, null, 2));
