import fs from "node:fs";
import path from "node:path";

const name = process.argv[2];
if (!name || !/^[a-z0-9-]+$/.test(name)) {
  console.error("Uso: npm run migration:new -- nome-da-migration");
  process.exit(1);
}

const migrations = listSql("migrations");
const next = String(migrations.length + 1).padStart(4, "0");
const file = path.join("migrations", `${next}_${name.replaceAll("-", "_")}.sql`);
fs.writeFileSync(file, "PRAGMA foreign_keys = ON;\n\n", { flag: "wx" });
console.log(file);

function listSql(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSql(full);
    return entry.name.endsWith(".sql") ? [full] : [];
  });
}
