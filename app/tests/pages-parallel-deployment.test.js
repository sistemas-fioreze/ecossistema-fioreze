import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildPages } from "../scripts/build-pages.js";

const root = process.cwd();
const workerConfig = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
const pagesConfig = JSON.parse(fs.readFileSync("pages/wrangler.jsonc", "utf8"));

test("Pages paralelo preserva Worker atual e bindings de desenvolvimento", () => {
  assert.equal(workerConfig.name, "fioreze-portais-dev");
  assert.equal(workerConfig.workers_dev, true);
  assert.equal(workerConfig.assets.directory, "./public");
  assert.equal(pagesConfig.name, "fioreze-portais-pages-dev");
  assert.notEqual(pagesConfig.name, workerConfig.name);
  assert.equal(pagesConfig.pages_build_output_dir, "./dist");
  assert.equal(pagesConfig.main, undefined);
  assert.equal(pagesConfig.assets, undefined);
  assert.equal(pagesConfig.workers_dev, undefined);

  const workerD1 = workerConfig.d1_databases.find((binding) => binding.binding === "DB");
  const pagesD1 = pagesConfig.d1_databases.find((binding) => binding.binding === "DB");
  assert.equal(pagesD1.database_name, workerD1.database_name);
  assert.equal(pagesD1.database_id, workerD1.database_id);

  const workerR2 = workerConfig.r2_buckets.find((binding) => binding.binding === "MEDIA_BUCKET");
  const pagesR2 = pagesConfig.r2_buckets.find((binding) => binding.binding === "MEDIA_BUCKET");
  assert.equal(pagesR2.bucket_name, workerR2.bucket_name);
  assert.deepEqual(pagesConfig.vars, workerConfig.vars);
});

test("build Pages gera _worker.js avancado e copia assets sem alteracao", async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(root, "pages", ".test-build-"));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const outputDir = path.join(temporaryRoot, "pages");
  await buildPages({ root, outputDir });

  for (const relative of ["index.html", "admin/index.html", "admin/portais/index.html", "erp/room-service/index.html"]) {
    assert.deepEqual(fs.readFileSync(path.join(outputDir, relative)), fs.readFileSync(path.join(root, "public", relative)));
  }

  const routes = JSON.parse(fs.readFileSync(path.join(outputDir, "_routes.json"), "utf8"));
  assert.deepEqual(routes, { version: 1, include: ["/*"], exclude: [] });

  const bundle = fs.readFileSync(path.join(outputDir, "_worker.js"), "utf8");
  assert.match(bundle, /export\s*\{[\s\S]*default/);
  assert.doesNotMatch(bundle, /sourceMappingURL=/);

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle).toString("base64")}#${Date.now()}`;
  const pagesWorker = (await import(moduleUrl)).default;
  const env = {
    ...pagesConfig.vars,
    DB: { prepare: () => assert.fail("health nao deve consultar D1") },
    MEDIA_BUCKET: {},
    ASSETS: {
      fetch: async (request) => new Response(`asset:${new URL(request.url).pathname}`, { status: 200 }),
    },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  const health = await pagesWorker.fetch(new Request("https://pages.example/api/v1/health"), env, ctx);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).data.database_binding, "DB");

  const admin = await pagesWorker.fetch(new Request("https://pages.example/admin/portais/media/"), env, ctx);
  assert.equal(admin.status, 200);
  assert.equal(await admin.text(), "asset:/admin/portais/");

  const directAsset = await pagesWorker.fetch(new Request("https://pages.example/css/core/reset.css"), env, ctx);
  assert.equal(await directAsset.text(), "asset:/css/core/reset.css");
});

test("build Pages rejeita saida fora do projeto ou dentro das fontes", async () => {
  await assert.rejects(() => buildPages({ root, outputDir: path.parse(root).root }), /nao pode substituir fontes/);
  await assert.rejects(() => buildPages({ root, outputDir: "public/build" }), /nao pode substituir fontes/);
});

test("scripts Pages usam configuracao dedicada", () => {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const launcher = fs.readFileSync("scripts/run-pages-wrangler.js", "utf8");
  assert.match(packageJson.scripts["pages:build"], /build-pages\.js/);
  assert.match(packageJson.scripts["pages:dev"], /run-pages-wrangler\.js dev/);
  assert.match(packageJson.scripts["pages:deploy"], /run-pages-wrangler\.js deploy/);
  assert.doesNotMatch(packageJson.scripts["pages:deploy"], /wrangler deploy(?:\s|$)/);
  assert.match(launcher, /cwd: pagesRoot/);
  assert.doesNotMatch(launcher, /--config/);
});
