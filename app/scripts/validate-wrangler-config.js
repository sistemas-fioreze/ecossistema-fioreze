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

if (config.d1_databases?.[0]?.binding !== "DB") {
  console.error("D1 binding deve ser DB.");
  process.exit(1);
}

if (JSON.stringify(config).includes("--remote") || config.d1_databases?.[0]?.remote === true) {
  console.error("Configuracao remota nao permitida nesta fase.");
  process.exit(1);
}

console.log("wrangler-config: ok");
