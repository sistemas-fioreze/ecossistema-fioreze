import fs from "node:fs/promises";
import path from "node:path";

export function resolveOutputDir(requested = "local-output/muller") {
  const root = process.cwd();
  const resolved = path.resolve(root, requested);
  const requiredRoot = path.resolve(root, "local-output", "muller");
  const relative = path.relative(requiredRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Saida deve ficar dentro de local-output/muller.");
  }
  return resolved;
}

export async function ensureOutputDir(requested) {
  const outputDir = resolveOutputDir(requested);
  await fs.mkdir(outputDir, { recursive: true });
  return outputDir;
}

export async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(`${filePath}.tmp`, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(`${filePath}.tmp`, filePath);
}

export function toPosixPath(value) {
  return value.replaceAll("\\", "/");
}
