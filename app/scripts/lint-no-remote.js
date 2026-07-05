import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const forbiddenScriptPatterns = [/--remote\b/, /wrangler\s+deploy\b/, /wrangler\s+login\b/, /wrangler\s+d1\s+create\b/];
const forbiddenCodePatterns = [
  /script\.google\.com/i,
  /docs\.google\.com\/spreadsheets/i,
  /127\.0\.0\.1:5050/i,
  /localhost:5050/i,
  /win32print/i,
  /APPS_SCRIPT_ENDPOINT/i,
];

const failures = [];

for (const [name, command] of Object.entries(packageJson.scripts || {})) {
  for (const pattern of forbiddenScriptPatterns) {
    if (pattern.test(command)) {
      failures.push(`script ${name} contem comando proibido`);
    }
  }
  if (/wrangler\s+d1\s+(execute|migrations\s+apply)\b/.test(command) && !/--local\b/.test(command)) {
    failures.push(`script ${name} usa D1 sem --local`);
  }
}

for (const file of listFiles(path.join(root, "src")).concat(listFiles(path.join(root, "public", "js")))) {
  const content = fs.readFileSync(file, "utf8");
  for (const pattern of forbiddenCodePatterns) {
    if (pattern.test(content)) {
      failures.push(`${path.relative(root, file)} contem referencia proibida`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("lint-no-remote: ok");

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return [full];
  });
}
