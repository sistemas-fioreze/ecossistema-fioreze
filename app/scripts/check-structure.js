import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "public/index.html",
  "public/css/modules/guest-portal/guest-portal.css",
  "public/js/core/portal-home.js",
  "public/admin/index.html",
  "public/admin/room-service/index.html",
  "public/admin/portais/index.html",
  "public/erp/room-service/index.html",
  "public/js/modules/admin/shared/admin-api.js",
  "public/js/modules/admin/shared/admin-auth-view.js",
  "public/js/modules/admin/shared/admin-select-picker.js",
  "public/js/modules/admin/shared/admin-session.js",
  "public/js/modules/admin/admin.js",
  "public/js/modules/admin/room-service.js",
  "public/js/modules/admin/portals.js",
  "public/js/modules/admin/guest-portal-editor.js",
  "public/css/modules/admin/guest-portal-editor.css",
  "public/js/modules/room-service/index.js",
  "public/css/modules/room-service/room-service.css",
  "public/js/modules/room-service-erp/app.js",
  "public/js/modules/room-service-erp/icon-system.js",
  "public/js/modules/room-service-erp/legacy-app.js",
  "public/js/vendor/lucide-erp.min.js",
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
  "src/modules/guest-portal/routes.js",
  "src/modules/guest-portal/shared.js",
  "src/services/public-portal-feeds.js",
  "src/modules/room-service/routes.js",
  "src/modules/admin/media.js",
  "src/modules/admin/erp-users.js",
  "src/modules/admin/erp-catalog.js",
  "src/modules/admin/erp-media.js",
  "src/modules/admin/erp-operations.js",
  "src/modules/admin/erp-profile.js",
  "src/modules/admin/hotels.js",
  "src/modules/admin/short-links.js",
  "src/modules/admin/custom-portal-pages.js",
  "src/modules/romantic-packages/routes.js",
  "src/modules/portal-pages/public.js",
  "src/modules/short-links/public.js",
  "src/modules/short-links/shared.js",
  "src/services/custom-html-sanitizer.js",
  "src/services/qr-code.js",
  "src/services/erp-auth.js",
  "scripts/build-pages.js",
  "scripts/run-pages-wrangler.js",
  "scripts/validate-pages-build.js",
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
  "migrations/0011a_admin_module_bootstrap.sql",
  "migrations/0012_admin_users_security.sql",
  "migrations/0013_admin_profile_avatars.sql",
  "migrations/0014_erp_hotel_users.sql",
  "migrations/0015_erp_operations_catalog_profiles.sql",
  "migrations/0016_catalog_item_tags.sql",
  "migrations/0020_portal_custom_pages_qr_links.sql",
  "migrations/0021_guest_portal_reference_features.sql",
  "migrations/0022_guest_portal_event_details.sql",
  "migrations/0023_guest_portal_event_actions.sql",
  "migrations/0025_visual_portal_builder.sql",
  "migrations/0026_retire_visual_portal_builder.sql",
  "migrations/0029_romantic_packages_media.sql",
  "seeds/dev.sql",
  "wrangler.jsonc",
  "pages/wrangler.jsonc",
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
const pagesWrangler = fs.readFileSync(path.join(root, "pages", "wrangler.jsonc"), "utf8");
const pagesWranglerConfig = JSON.parse(pagesWrangler);
const databaseId = wranglerConfig.d1_databases?.[0]?.database_id || "";
const pagesDatabase = pagesWranglerConfig.d1_databases?.find((database) => database.binding === "DB");
const mediaBucket = wranglerConfig.r2_buckets?.find((bucket) => bucket.binding === "MEDIA_BUCKET");
const pagesMediaBucket = pagesWranglerConfig.r2_buckets?.find((bucket) => bucket.binding === "MEDIA_BUCKET");
const idMatches = databaseId ? countOccurrences(wrangler, databaseId) : [];
const otherFilesWithDatabaseId = listFiles(root).filter((file) => {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  if (relative === "wrangler.jsonc" || relative === "pages/wrangler.jsonc") return false;
  if (relative.startsWith("node_modules/") || relative === "package-lock.json") return false;
  if (isBinaryPath(relative)) return false;
  return databaseId && fs.readFileSync(file, "utf8").includes(databaseId);
});
if (!databaseId || idMatches !== 1) failures.push("database_id deve aparecer uma vez em wrangler.jsonc");
if (pagesDatabase?.database_id !== databaseId || countOccurrences(pagesWrangler, databaseId) !== 1) {
  failures.push("Pages deve preservar o mesmo database_id no binding DB");
}
if (otherFilesWithDatabaseId.length) failures.push("database_id apareceu fora das configuracoes Wrangler");
if (!mediaBucket || mediaBucket.bucket_name !== "fioreze-portais-media-dev") {
  failures.push("MEDIA_BUCKET deve existir e apontar para fioreze-portais-media-dev");
}
if (pagesMediaBucket?.bucket_name !== mediaBucket?.bucket_name) {
  failures.push("Pages deve preservar o binding MEDIA_BUCKET");
}
if (mediaBucket?.remote === true) failures.push("MEDIA_BUCKET nao deve usar remote=true");
if (pagesMediaBucket?.remote === true) failures.push("MEDIA_BUCKET do Pages nao deve usar remote=true");
if (pagesWranglerConfig.name === wranglerConfig.name) failures.push("Pages nao pode reutilizar o nome do Worker atual");
if (pagesWranglerConfig.pages_build_output_dir !== "./dist") failures.push("diretorio de build Pages invalido");

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
