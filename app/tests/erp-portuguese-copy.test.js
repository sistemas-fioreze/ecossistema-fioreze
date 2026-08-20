import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { normalizeErpPortugueseText } from "../public/js/modules/room-service-erp/ui-language-polish.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("ERP Portuguese polish restores diacritics without touching identifiers", () => {
  const cases = new Map([
    ["ACOMODACOES", "ACOMODAÇÕES"],
    ["Acomodacoes da unidade", "Acomodações da unidade"],
    ["Configuracoes", "Configurações"],
    ["PREFERENCIAS DA UNIDADE", "PREFERÊNCIAS DA UNIDADE"],
    ["Hospedes e acomodacoes", "Hóspedes e acomodações"],
    ["Codigo do usuario", "Código do usuário"],
    ["Cardapio · Preco · Descricao", "Cardápio · Preço · Descrição"],
    ["Visao geral da operacao", "Visão geral da operação"],
    ["Consultar historico", "Consultar histórico"],
    ["Situacao dos pedidos", "Situação dos pedidos"],
    ["Com observacao", "Com observação"],
    ["Atualizacao do aplicativo", "Atualização do aplicativo"],
    ["Nova versao disponivel", "Nova versão disponível"],
    ["Nao foi possivel verificar a sessao", "Não foi possível verificar a sessão"],
    ["Impressao e notificacoes", "Impressão e notificações"],
    ["Suite e exibicao", "Suíte e exibição"],
    ["ERP Room Service", "ERP Room Service"],
    ["room-service.settings.manage", "room-service.settings.manage"],
  ]);

  for (const [source, expected] of cases) {
    assert.equal(normalizeErpPortugueseText(source), expected, source);
  }
});

test("ERP entrypoint enables Portuguese polish for browser and Electron", () => {
  const app = read("app/public/js/modules/room-service-erp/app.js");
  assert.match(app, /ui-language-polish\.js/);
  assert.match(app, /setupErpPortuguesePolish\(\)/);
  assert.ok(app.indexOf("setupErpPortuguesePolish();") < app.indexOf("setupDesktopControls();"));
});

test("modern ERP modules and native fallback screens keep reviewed Portuguese copy", () => {
  const reviewed = [
    "app/public/js/modules/room-service-erp/static-config.js",
    "app/public/js/modules/room-service-erp/settings.js",
    "app/public/js/modules/room-service-erp/orders.js",
    "app/public/js/modules/room-service-erp/billing.js",
    "app/public/js/modules/room-service-erp/catalog.js",
    "app/public/js/modules/room-service-erp/pos.js",
    "app/public/js/modules/room-service-erp/guests.js",
    "app/public/js/modules/room-service-erp/session.js",
    "desktop/room-service/updater.cjs",
    "desktop/room-service/unconfigured.html",
  ].map(read).join("\n");

  const forbiddenUiSpellings = [
    "Acomodacoes",
    "acomodacoes",
    "Configuracoes",
    "Preferencias",
    "Hospedes",
    "Hospede",
    "Cardapio",
    "Catalogo",
    "Codigo do usuario",
    "Nao foi possivel",
    "Impressao desativada",
    "Atualizacao",
    "Atualizacoes",
    "Versao ",
    " disponivel",
    " instalacao ",
  ];

  for (const spelling of forbiddenUiSpellings) {
    assert.doesNotMatch(reviewed, new RegExp(spelling.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
