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
const r2 = config.r2_buckets?.find((bucket) => bucket.binding === "MEDIA_BUCKET") || {};
const workerFirstRoutes = new Set(config.assets?.run_worker_first || []);
const shortLinkRoute = (config.routes || []).find((route) => route.pattern === "go.hoteisfioreze.com.br");

if (config.workers_dev !== true) {
  console.error("workers_dev deve permanecer true como fallback tecnico dos links.");
  process.exit(1);
}

if (JSON.stringify(config.triggers?.crons) !== JSON.stringify(["*/15 * * * *"])) {
  console.error("O ciclo automatico de eventos deve executar a cada 15 minutos.");
  process.exit(1);
}

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

if (r2.binding !== "MEDIA_BUCKET" || r2.bucket_name !== "fioreze-portais-media-dev") {
  console.error("R2 binding MEDIA_BUCKET deve apontar para fioreze-portais-media-dev.");
  process.exit(1);
}

if (r2.remote === true || /prod/i.test(r2.bucket_name || "")) {
  console.error("R2 remoto ou bucket de producao nao permitido nesta fase.");
  process.exit(1);
}

if (workerFirstRoutes.size !== 1 || !workerFirstRoutes.has("/*")) {
  console.error("Static Assets deve executar o Worker primeiro em todas as rotas com /*.");
  process.exit(1);
}

if (config.vars?.GUEST_PORTAL_PUBLIC_ORIGIN !== "https://portal.hoteisfioreze.com.br") {
  console.error("GUEST_PORTAL_PUBLIC_ORIGIN deve apontar para o dominio oficial do Portal do Hospede.");
  process.exit(1);
}

if (Object.hasOwn(config.vars || {}, "VISUAL_PORTAL_PUBLIC_ORIGIN")) {
  console.error("VISUAL_PORTAL_PUBLIC_ORIGIN pertence ao criador visual descontinuado.");
  process.exit(1);
}

if (shortLinkRoute) {
  console.error("O dominio curto e entregue pelo Pages e nao deve ser vinculado ao Worker.");
  process.exit(1);
}

if (config.vars?.SHORT_LINK_PUBLIC_ORIGIN !== "https://go.hoteisfioreze.com.br") {
  console.error("SHORT_LINK_PUBLIC_ORIGIN deve apontar para o dominio curto oficial.");
  process.exit(1);
}

if (String(config.vars?.TURNSTILE_ENABLED).toLowerCase() !== "false") {
  console.error("TURNSTILE_ENABLED deve permanecer false na configuracao padrao ate ativacao controlada.");
  process.exit(1);
}

for (const secretName of ["TURNSTILE_SECRET_KEY", "LOGIN_RATE_LIMIT_KEY"]) {
  if (Object.hasOwn(config.vars || {}, secretName)) {
    console.error(`${secretName} nao pode ser versionada nas vars do Wrangler.`);
    process.exit(1);
  }
}

console.log("wrangler-config: ok");
