import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "public/index.html",
  "public/admin/index.html",
  "public/admin/room-service/index.html",
  "public/admin/portais/index.html",
  "public/erp/room-service/index.html",
  "public/js/modules/admin/shared/admin-api.js",
  "public/js/modules/admin/shared/admin-auth-view.js",
  "public/js/modules/admin/shared/admin-session.js",
  "public/js/modules/admin/admin.js",
  "public/js/modules/admin/room-service.js",
  "public/js/modules/admin/portals.js",
  "public/js/modules/room-service-erp/app.js",
  "public/js/modules/room-service-erp/legacy-app.js",
  "public/js/modules/room-service-erp/session.js",
  "public/js/modules/room-service-erp/shell.js",
  "public/js/modules/room-service-erp/orders.js",
  "public/css/modules/room-service-erp/shell.css",
  "public/css/modules/room-service-erp/legacy-adapter.css",
  "public/css/modules/room-service-erp/legacy-tailwind.css",
  "src/index.js",
  "src/core/router.js",
  "src/core/tenant.js",
  "src/core/module-registry.js",
  "src/modules/room-service/routes.js",
  "src/modules/admin/media.js",
  "src/modules/admin/hotels.js",
  "src/modules/admin/short-links.js",
  "src/modules/short-links/public.js",
  "src/modules/short-links/shared.js",
  "migrations/0001_core_initial.sql",
  "migrations/0002_core_admin.sql",
  "migrations/0003_guest_portal_foundation.sql",
  "migrations/0004_room_service.sql",
  "migrations/0005_spa_foundation.sql",
  "migrations/0006_romantic_packages_foundation.sql",
  "migrations/0007_core_service_hours_media_assets.sql",
  "migrations/0008_media_library_foundation.sql",
  "migrations/0009_admin_units_management_permissions.sql",
  "migrations/0010_embed_permissions.sql",
  "migrations/0011_short_links_foundation.sql",
  "seeds/dev.sql",
  "wrangler.jsonc",
  ".dev.vars.example",
];

const forbiddenDirs = ["muller", "fioreze-centro", "hotel-3"].map((dir) => path.join(root, dir));
const failures = [];

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) failures.push(`ausente: ${relative}`);
}

for (const dir of forbiddenDirs) {
  if (fs.existsSync(dir)) failures.push(`diretorio proibido: ${path.relative(root, dir)}`);
}

const wrangler = fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
const wranglerConfig = JSON.parse(wrangler);
const databaseId = wranglerConfig.d1_databases?.[0]?.database_id || "";
const mediaBucket = wranglerConfig.r2_buckets?.find((bucket) => bucket.binding === "MEDIA_BUCKET");
const idMatches = databaseId ? countOccurrences(wrangler, databaseId) : [];
const otherFilesWithDatabaseId = listFiles(root).filter((file) => {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  if (relative === "wrangler.jsonc") return false;
  if (relative.startsWith("node_modules/") || relative === "package-lock.json") return false;
  if (isBinaryPath(relative)) return false;
  return databaseId && fs.readFileSync(file, "utf8").includes(databaseId);
});
if (!databaseId || idMatches !== 1) failures.push("database_id deve aparecer uma vez em wrangler.jsonc");
if (otherFilesWithDatabaseId.length) failures.push("database_id apareceu fora do wrangler.jsonc");
if (!mediaBucket || mediaBucket.bucket_name !== "fioreze-portais-media-dev") {
  failures.push("MEDIA_BUCKET deve existir e apontar para fioreze-portais-media-dev");
}
if (mediaBucket?.remote === true) failures.push("MEDIA_BUCKET nao deve usar remote=true");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("structure-check: ok");

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    const relative = path.relative(root, full).replaceAll("\\", "/");
    if (relative.startsWith("node_modules/") || relative.startsWith(".wrangler/")) return [];
    if (entry.isDirectory()) return listFiles(full);
    return [full];
  });
}

function countOccurrences(content, value) {
  return content.split(value).length - 1;
}

function isBinaryPath(relative) {
  return /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip)$/i.test(relative);
}
