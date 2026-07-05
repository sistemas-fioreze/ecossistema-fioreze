import fs from "node:fs";
import path from "node:path";

if (process.env.CONFIRM_LOCAL_DB_RESET !== "yes") {
  console.error("Reset local bloqueado. Execute com CONFIRM_LOCAL_DB_RESET=yes.");
  process.exit(1);
}

const stateDir = path.join(process.cwd(), ".wrangler", "state");
if (!fs.existsSync(stateDir)) {
  console.log("Nenhum banco local encontrado.");
  process.exit(0);
}

fs.rmSync(stateDir, { recursive: true, force: true });
console.log("Estado local do Wrangler removido. Reaplique migrations e seeds locais.");
