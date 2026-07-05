#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs, arrayArg, stringArg } from "./lib/args.js";
import { analyzeAppsScript } from "./lib/apps-script.js";
import { fileSha256 } from "./lib/hash.js";
import { ensureOutputDir, writeJson } from "./lib/paths.js";
import { analyzeWorkbook, readTabularFile } from "./lib/spreadsheet.js";

const args = parseArgs();
const spreadsheets = arrayArg(args.spreadsheet);
const appScript = stringArg(args["apps-script"]);
const outputDir = await ensureOutputDir(stringArg(args.output, "local-output/muller"));

if (!spreadsheets.length && !appScript) {
  throw new Error("Informe --spreadsheet e/ou --apps-script.");
}

const workbookReports = [];
for (const spreadsheetPath of spreadsheets) {
  const workbook = await readTabularFile(spreadsheetPath);
  workbookReports.push({
    file_name: path.basename(spreadsheetPath),
    file_size_bytes: (await fs.stat(spreadsheetPath)).size,
    sha256: await fileSha256(spreadsheetPath),
    ...analyzeWorkbook(workbook),
  });
}

const appScriptReport = appScript
  ? {
      file_name: path.basename(appScript),
      file_size_bytes: (await fs.stat(appScript)).size,
      sha256: await fileSha256(appScript),
      analysis: await analyzeAppsScript(appScript),
    }
  : null;

const report = {
  generated_at: new Date().toISOString(),
  workbooks: workbookReports,
  app_script: appScriptReport,
};

await writeJson(path.join(outputDir, "input-inspection.json"), report);
console.log(JSON.stringify({
  output: path.join(outputDir, "input-inspection.json"),
  spreadsheets: workbookReports.length,
  sheets: workbookReports.reduce((sum, item) => sum + item.sheets.length, 0),
  app_script_functions: appScriptReport?.analysis.function_count || 0,
}, null, 2));
