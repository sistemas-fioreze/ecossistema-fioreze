import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workerConfig = readJson("wrangler.jsonc");
const pagesConfig = readJson("pages/wrangler.jsonc");
const outputDir = path.resolve(root, "pages", pagesConfig.pages_build_output_dir || "");
const failures = [];

if (!pagesConfig.name || pagesConfig.name === workerConfig.name) failures.push("projeto Pages deve ter nome proprio");
if (pagesConfig.pages_build_output_dir !== "./dist") failures.push("Pages deve usar pages/dist");
if (pagesConfig.compatibility_date !== workerConfig.compatibility_date) failures.push("compatibility_date deve acompanhar o Worker");
if ("main" in pagesConfig || "assets" in pagesConfig || "workers_dev" in pagesConfig || "routes" in pagesConfig) {
  failures.push("configuracao Pages nao deve assumir campos de deploy do Worker");
}

compareBinding("DB", workerConfig.d1_databases, pagesConfig.d1_databases, ["binding", "database_name", "database_id"]);
compareBinding("MEDIA_BUCKET", workerConfig.r2_buckets, pagesConfig.r2_buckets, ["binding", "bucket_name"]);

for (const [key, value] of Object.entries(workerConfig.vars || {})) {
  if (pagesConfig.vars?.[key] !== value) failures.push(`variavel Pages divergente: ${key}`);
}

for (const relative of ["_worker.js", "_routes.json", "index.html", "admin/index.html", "erp/room-service/index.html"]) {
  if (!fs.existsSync(path.join(outputDir, relative))) failures.push(`artefato Pages ausente: ${relative}`);
}

const routes = readJson(path.join(outputDir, "_routes.json"), true);
if (routes.version !== 1 || routes.include?.length !== 1 || routes.include[0] !== "/*" || routes.exclude?.length !== 0) {
  failures.push("_routes.json deve encaminhar todas as rotas ao _worker.js");
}

for (const sourceFile of listFiles(path.join(root, "public"))) {
  const relative = path.relative(path.join(root, "public"), sourceFile);
  const builtFile = path.join(outputDir, relative);
  if (!fs.existsSync(builtFile) || fileHash(sourceFile) !== fileHash(builtFile)) {
    failures.push(`asset Pages divergente: ${relative.replaceAll("\\", "/")}`);
  }
}

const workerPath = path.join(outputDir, "_worker.js");
const workerBundle = fs.existsSync(workerPath) ? fs.readFileSync(workerPath, "utf8") : "";
if (workerBundle.length < 1024 || !/export\s*\{[\s\S]*default/.test(workerBundle)) {
  failures.push("_worker.js nao contem bundle ESM valido");
}
if (/sourceMappingURL=/.test(workerBundle)) failures.push("_worker.js nao deve publicar source map");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("pages-build-check: ok");

function compareBinding(name, workerBindings = [], pagesBindings = [], fields) {
  const workerBinding = workerBindings.find((binding) => binding.binding === name);
  const pagesBinding = pagesBindings.find((binding) => binding.binding === name);
  if (!workerBinding || !pagesBinding) {
    failures.push(`binding ausente: ${name}`);
    return;
  }
  for (const field of fields) {
    if (pagesBinding[field] !== workerBinding[field]) failures.push(`binding ${name} divergente em ${field}`);
  }
}

function readJson(relativeOrAbsolute, absolute = false) {
  const file = absolute ? relativeOrAbsolute : path.join(root, relativeOrAbsolute);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

function fileHash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
