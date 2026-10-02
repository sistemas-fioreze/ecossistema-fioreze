import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveStandaloneCatalog,
  standaloneCatalogs,
} from "../public/js/core/standalone-catalogs.js";
import { romanticPackagesInternalsForTests } from "../public/js/modules/romantic-packages/index.js";
import { createWorkerTestContext } from "./helpers/worker.js";

test("catalogos compartilhaveis possuem rotas curtas e unidades canonicas", () => {
  assert.deepEqual(
    standaloneCatalogs().map(({ path, hotelSlug, moduleKey }) => ({ path, hotelSlug, moduleKey })),
    [
      { path: "/spa", hotelSlug: "muller", moduleKey: "spa" },
      { path: "/pacotes-centro", hotelSlug: "centro", moduleKey: "romantic-packages" },
      { path: "/pacotes-muller", hotelSlug: "muller", moduleKey: "romantic-packages" },
    ],
  );
  assert.equal(resolveStandaloneCatalog("/spa/")?.path, "/spa");
  assert.equal(resolveStandaloneCatalog("/pacotes-centro/detalhe"), null);
  assert.equal(resolveStandaloneCatalog("/centro/romantic-packages"), null);
});

test("detalhes de pacotes preservam a rota curta quando o catalogo e compartilhavel", () => {
  assert.equal(
    romanticPackagesInternalsForTests.packageRoutePath({
      routePath: "/pacotes-centro",
      bootstrap: { slug: "centro" },
    }),
    "/pacotes-centro",
  );
  assert.equal(
    romanticPackagesInternalsForTests.packageRoutePath({ bootstrap: { slug: "centro" } }),
    "/centro/romantic-packages",
  );
});

test("Worker serve os tres catalogos sem expor uma rota de modulo desabilitado", async () => {
  const context = createWorkerTestContext();
  installProductionAliases(context.env);

  for (const path of ["/spa", "/spa/", "/pacotes-centro", "/pacotes-muller"]) {
    const response = await context.fetch(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), /<body>\/<\/body>/, path);
  }

  const mullerPackages = context.env.__data.hotelModules.find(
    (entry) => entry.hotel_id === "muller-fioreze" && entry.module_key === "romantic-packages",
  );
  mullerPackages.enabled = 0;
  assert.equal((await context.fetch("/pacotes-muller")).status, 404);
  assert.equal((await context.fetch("/spa")).status, 200);
});

function installProductionAliases(env) {
  const muller = env.__data.hotels.find((hotel) => hotel.id === "muller-fioreze");
  muller.slug = "muller";
  enablePublicModule(env, muller.id, "spa");
  enablePublicModule(env, muller.id, "romantic-packages");

  const source = env.__data.hotels.find((hotel) => hotel.id === "aurora-demo");
  env.__data.hotels.push({
    ...source,
    id: "fiorezecentro",
    slug: "centro",
    name: "Hotel Fioreze Centro",
    short_name: "Fioreze Centro",
  });
  enablePublicModule(env, "fiorezecentro", "romantic-packages");
}

function enablePublicModule(env, hotelId, moduleKey) {
  const current = env.__data.hotelModules.find(
    (entry) => entry.hotel_id === hotelId && entry.module_key === moduleKey,
  );
  if (current) {
    current.enabled = 1;
    current.is_public = 1;
    return;
  }
  env.__data.hotelModules.push({
    hotel_id: hotelId,
    module_key: moduleKey,
    enabled: 1,
    is_public: 1,
    public_name: moduleKey === "spa" ? "Spa" : "Decoracoes Especiais",
    navigation_label: moduleKey === "spa" ? "Spa" : "Decoracoes Especiais",
    sort_order: 50,
    settings_json: null,
  });
}
