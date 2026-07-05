import crypto from "node:crypto";
import fs from "node:fs/promises";

export async function fileSha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(await fs.readFile(filePath));
  return hash.digest("hex");
}

export function stableHash(value, length = 10) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}
