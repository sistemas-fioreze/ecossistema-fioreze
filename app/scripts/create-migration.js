import fs from "node:fs";
import path from "node:path";

const name = process.argv[2];
if (!name || !/^[a-z0-9-]+$/.test(name)) {
  console.error("Uso: npm run migration:new -- nome-da-migration");
  process.exit(1);
}

const migrationsDir = "migrations";
const migrations = listSql(migrationsDir);
const next = String(nextMigrationNumber(migrations)).padStart(4, "0");
const file = path.join(migrationsDir, `${next}_${name.replaceAll("-", "_")}.sql`);
fs.writeFileSync(file, "PRAGMA foreign_keys = ON;\n\n", { flag: "wx" });
console.log(file);

function listSql(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => path.join(dir, entry.name));
}

function nextMigrationNumber(files) {
  const highest = files.reduce((max, file) => {
    const match = path.basename(file).match(/^(\d{4})_/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return highest + 1;
}
