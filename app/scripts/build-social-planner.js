import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

export async function buildSocialPlanner({ root = process.cwd() } = {}) {
  await build({
    entryPoints: [path.join(root, "social-planner", "app.ts")],
    outfile: path.join(root, "public", "js", "modules", "social-planner", "planner.js"),
    bundle: true, format: "esm", platform: "browser", target: "es2022",
    minify: false, sourcemap: false, legalComments: "none",
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildSocialPlanner();
  console.log("social-planner: build concluído");
}
