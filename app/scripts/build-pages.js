import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const DEFAULT_OUTPUT = "pages/dist";

export async function buildPages({ root = process.cwd(), outputDir = DEFAULT_OUTPUT } = {}) {
  const projectRoot = path.resolve(root);
  const publicDir = path.join(projectRoot, "public");
  const entryPoint = path.join(projectRoot, "src", "index.js");
  const resolvedOutput = path.resolve(projectRoot, outputDir);

  await assertBuildInputs({ projectRoot, publicDir, entryPoint, resolvedOutput });
  await fs.rm(resolvedOutput, { recursive: true, force: true });
  await fs.mkdir(resolvedOutput, { recursive: true });
  await fs.cp(publicDir, resolvedOutput, { recursive: true });

  await build({
    entryPoints: [entryPoint],
    outfile: path.join(resolvedOutput, "_worker.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    conditions: ["worker", "browser"],
    legalComments: "none",
    logLevel: "silent",
    minify: false,
    sourcemap: false,
  });

  await fs.writeFile(
    path.join(resolvedOutput, "_routes.json"),
    `${JSON.stringify({ version: 1, include: ["/*"], exclude: [] }, null, 2)}\n`,
    "utf8",
  );

  return {
    outputDir: resolvedOutput,
    workerPath: path.join(resolvedOutput, "_worker.js"),
  };
}

async function assertBuildInputs({ projectRoot, publicDir, entryPoint, resolvedOutput }) {
  const protectedPaths = [publicDir, path.join(projectRoot, "src"), path.join(projectRoot, "scripts")];
  const isInsideProject = resolvedOutput.startsWith(`${projectRoot}${path.sep}`);
  const overlapsSources = protectedPaths.some(
    (protectedPath) => resolvedOutput === protectedPath || resolvedOutput.startsWith(`${protectedPath}${path.sep}`),
  );
  if (!isInsideProject || overlapsSources) {
    throw new Error("Diretorio de saida do Pages nao pode substituir fontes do projeto.");
  }

  const [publicStat, entryStat] = await Promise.all([fs.stat(publicDir), fs.stat(entryPoint)]);
  if (!publicStat.isDirectory() || !entryStat.isFile()) {
    throw new Error("Entradas do build Pages nao foram encontradas.");
  }
}

function parseOutputArgument(argv) {
  const outputArgument = argv.find((argument) => argument.startsWith("--output="));
  return outputArgument ? outputArgument.slice("--output=".length) : DEFAULT_OUTPUT;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await buildPages({ outputDir: parseOutputArgument(process.argv.slice(2)) });
  console.log(`pages-build: ${path.relative(process.cwd(), result.outputDir)}`);
}
