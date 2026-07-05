import fs from "node:fs";
import Ajv from "ajv";

const configText = fs.readFileSync("wrangler.jsonc", "utf8");
const config = JSON.parse(configText);
const schema = JSON.parse(fs.readFileSync("node_modules/wrangler/config-schema.json", "utf8"));

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const configForSchema = { ...config };
delete configForSchema.$schema;

if (!validate(configForSchema)) {
  console.error(validate.errors);
  process.exit(1);
}

const d1 = config.d1_databases?.[0] || {};

if (d1.binding !== "DB") {
  console.error("D1 binding deve ser DB.");
  process.exit(1);
}

if (d1.migrations_dir !== "migrations" || d1.migrations_pattern !== "migrations/*.sql") {
  console.error("Migrations D1 devem usar app/migrations/*.sql em ordem global.");
  process.exit(1);
}

if (JSON.stringify(config).includes("--remote") || d1.remote === true) {
  console.error("Configuracao remota nao permitida nesta fase.");
  process.exit(1);
}

console.log("wrangler-config: ok");
