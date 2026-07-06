#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseArgs, arrayArg, stringArg } from "./lib/args.js";
import { readBeforeStateSnapshot } from "./lib/before-state.js";
import { normalizeCatalog } from "./lib/catalog.js";
import { buildExecutableCatalogImportPackage } from "./lib/catalog-import-package.js";
import { validateCatalogImportPackage } from "./lib/catalog-import-validation.js";
import { auditData } from "./lib/data-quality.js";
import { fileSha256 } from "./lib/hash.js";
import { buildImportPlan } from "./lib/import-plan.js";
import { normalizeOrders } from "./lib/orders.js";
import { ensureOutputDir, writeJson } from "./lib/paths.js";
import { readTabularFile } from "./lib/spreadsheet.js";

const execFileAsync = promisify(execFile);
const args = parseArgs();
if (!args["dry-run"]) throw new Error("Por seguranca, use --dry-run. Esta ferramenta nao escreve no D1.");
const spreadsheets = arrayArg(args.spreadsheet);
if (!spreadsheets.length) throw new Error("Informe ao menos um --spreadsheet.");

const hotelId = stringArg(args.hotel, "muller-fioreze");
const moduleKey = stringArg(args.module, "room-service");
const outputFormat = stringArg(args["output-format"], "parameterized-preview");
const defaultOutputDir = outputFormat === "executable-sql" ? "local-output/muller/catalog-import" : "local-output/muller";
const outputDir = await ensureOutputDir(stringArg(args.output, defaultOutputDir));
const workbooks = [];
const inputHashes = [];
for (const spreadsheet of spreadsheets) {
  workbooks.push(await readTabularFile(spreadsheet));
  inputHashes.push({ file_name: path.basename(spreadsheet), sha256: await fileSha256(spreadsheet) });
}

const catalogData = normalizeCatalog(workbooks, { hotelId, moduleKey });
const orderData = normalizeOrders(workbooks, { hotelId, moduleKey });
const audit = auditData({ workbooks, catalogData, orderData });

if (outputFormat === "executable-sql") {
  const repoRoot = await findRepoRoot(process.cwd());
  const beforeStatePath = stringArg(args["before-state"], "");
  const beforeState = beforeStatePath
    ? await readBeforeStateSnapshot(beforeStatePath, { hotelId, moduleKey })
    : null;
  const importPackage = buildExecutableCatalogImportPackage({
    catalogData,
    hotelId,
    moduleKey,
    inputHashes,
    gitHead: await getGitHead(repoRoot),
    archiveMissing: Boolean(args["archive-missing"]),
    beforeState,
  });
  const validation = {
    static: importPackage.validation,
    input_audit: {
      products_found: audit.products_found,
      categories_found: audit.categories_found,
      duplicate_names: audit.duplicate_names,
      unavailable_products: audit.unavailable_products,
      invalid_prices: audit.invalid_prices,
      products_without_price: audit.products_without_price,
      invalid_image_links: audit.invalid_image_links,
      workbook_sheets: audit.workbook_sheets.map((sheet) => ({
        file_hash: inputHashes.find((entry) => path.basename(sheet.file) === entry.file_name)?.sha256 || null,
        sheet: sheet.sheet,
        rows: sheet.rows,
        formulas: sheet.formulas,
        links: sheet.links,
        sensitive_categories: sheet.sensitive_categories,
      })),
    },
    local_database: await validateCatalogImportPackage({
      applySql: importPackage.applySql,
      rollbackSql: importPackage.remoteRollbackSql || importPackage.fixtureRollbackSql,
      manifest: importPackage.manifest,
      repoRoot,
      baselineSnapshot: beforeState?.snapshot,
      outputDatabasePath: path.join(outputDir, "catalog-validation.sqlite"),
    }),
  };

  await fs.writeFile(path.join(outputDir, "catalog.apply.sql"), importPackage.applySql, "utf8");
  await fs.writeFile(path.join(outputDir, "catalog.fixture-rollback.sql"), importPackage.fixtureRollbackSql, "utf8");
  await fs.writeFile(path.join(outputDir, "catalog.snapshot-query.sql"), importPackage.snapshotQuerySql, "utf8");
  if (importPackage.remoteRollbackSql) {
    await fs.writeFile(path.join(outputDir, "catalog.rollback.sql"), importPackage.remoteRollbackSql, "utf8");
  } else {
    await removeIfExists(path.join(outputDir, "catalog.rollback.sql"));
  }
  await writeJson(path.join(outputDir, "catalog.manifest.json"), importPackage.manifest);
  await writeJson(path.join(outputDir, "catalog.validation.json"), validation);
  await writeJson(path.join(outputDir, "catalog.before.expected.json"), importPackage.beforeExpected);
  await writeJson(path.join(outputDir, "catalog.after.expected.json"), importPackage.afterExpected);

  console.log(JSON.stringify({
    mode: "dry-run",
    output_format: outputFormat,
    output_dir: outputDir,
    summary: importPackage.manifest.counts,
    validation: {
      ok: validation.local_database.ok,
      static_errors: validation.static.errors.length,
      invalid_prices: audit.invalid_prices,
      products_without_price: audit.products_without_price,
      duplicate_names: audit.duplicate_names,
    },
    files: [
      "catalog.apply.sql",
      "catalog.fixture-rollback.sql",
      "catalog.snapshot-query.sql",
      ...(importPackage.remoteRollbackSql ? ["catalog.rollback.sql"] : []),
      "catalog.manifest.json",
      "catalog.validation.json",
      "catalog.before.expected.json",
      "catalog.after.expected.json",
    ],
  }, null, 2));
} else {
  const plan = buildImportPlan({ catalogData, hotelId, moduleKey, inputHashes });
  await writeJson(path.join(outputDir, "catalog.normalized.json"), catalogData);
  await writeJson(path.join(outputDir, "orders.anonymized.json"), orderData);
  await writeJson(path.join(outputDir, "validation-report.json"), audit);
  await fs.writeFile(path.join(outputDir, "import-preview.sql"), `${plan.sql_preview}\n`, "utf8");
  await writeJson(path.join(outputDir, "import-preview.parameters.json"), plan.parameters);

  console.log(JSON.stringify({
    mode: "dry-run",
    output_format: outputFormat,
    output_dir: outputDir,
    summary: plan.summary,
    validation: {
      invalid_prices: audit.invalid_prices,
      products_without_name: audit.products_without_name,
      products_without_price: audit.products_without_price,
      duplicate_names: audit.duplicate_names,
    },
  }, null, 2));
}

async function removeIfExists(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function getGitHead(repoRoot) {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function findRepoRoot(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    try {
      await fs.access(path.join(current, "app", "migrations"));
      await fs.access(path.join(current, "tools", "migration", "muller-room-service"));
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) throw new Error("Nao foi possivel localizar a raiz do repositorio.");
      current = parent;
    }
  }
}
