import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const command = process.argv[2];
if (!new Set(["dev", "deploy"]).has(command)) {
  console.error("Uso: node scripts/run-pages-wrangler.js <dev|deploy> [argumentos]");
  process.exit(1);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagesRoot = path.join(projectRoot, "pages");
const wranglerBin = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const result = spawnSync(process.execPath, [wranglerBin, "pages", command, ...process.argv.slice(3)], {
  cwd: pagesRoot,
  env: process.env,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
