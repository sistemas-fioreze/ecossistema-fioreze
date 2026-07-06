import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { normalizeCatalog } from "../lib/catalog.js";
import { buildExecutableCatalogImportPackage } from "../lib/catalog-import-package.js";
import { validateCatalogImportPackage } from "../lib/catalog-import-validation.js";
import { auditData } from "../lib/data-quality.js";
import { buildImportPlan } from "../lib/import-plan.js";
import { normalizeMoneyToCents, normalizeBoolean, normalizeDateToIso } from "../lib/normalize.js";
import { normalizeOrders } from "../lib/orders.js";
import { sqliteJsonLiteral, sqliteLiteral } from "../lib/sqlite-literals.js";
import { readTabularFile } from "../lib/spreadsheet.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

test("le CSV ficticio e normaliza catalogo multi-hotel/modulo", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "muller-tool-"));
  const csv = path.join(dir, "catalogo.csv");
  await fs.writeFile(
    csv,
    "Categoria;Produto;Descricao;Preco;Disponivel\nBebidas;Suco Demo;Item ficticio;R$ 12,50;sim\nBebidas;Produto Sem Preco;Falta preco;;nao\n",
    "utf8",
  );

  const workbook = await readTabularFile(csv);
  const catalog = normalizeCatalog([workbook], { hotelId: "muller-fioreze", moduleKey: "room-service" });

  assert.equal(catalog.categories.length, 1);
  assert.equal(catalog.items.length, 2);
  assert.equal(catalog.items[0].hotel_id, "muller-fioreze");
  assert.equal(catalog.items[0].module_key, "room-service");
  assert.equal(catalog.items[0].price_cents, 1250);
  assert.equal(catalog.items[1].validation.price_reason, "missing");
});

test("le XLSX ficticio com formula sem expor dados reais", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "muller-tool-xlsx-"));
  const xlsx = path.join(dir, "catalogo.xlsx");
  await fs.writeFile(xlsx, createMinimalXlsx());

  const workbook = await readTabularFile(xlsx);
  assert.equal(workbook.sheets[0].name, "Cardapio");
  assert.equal(workbook.sheets[0].rows[0][0], "Categoria");
  assert.equal(workbook.sheets[0].formulas.length, 1);

  const catalog = normalizeCatalog([workbook], { hotelId: "muller-fioreze", moduleKey: "room-service" });
  assert.equal(catalog.items[0].name, "Produto Demo");
  assert.equal(catalog.items[0].price_cents, 990);
});

test("normalizadores tratam moeda brasileira, booleanos e datas brasileiras", () => {
  assert.deepEqual(normalizeMoneyToCents("R$ 1.234,56"), { cents: 123456, valid: true, reason: null });
  assert.equal(normalizeBoolean("indisponivel"), false);
  assert.equal(normalizeBoolean("sim"), true);
  assert.equal(normalizeDateToIso("05/07/2026 16:30").valid, true);
});

test("auditoria detecta duplicidade, produto sem categoria e preco invalido", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "muller-tool-audit-"));
  const csv = path.join(dir, "catalogo.csv");
  await fs.writeFile(csv, "Categoria,Produto,Preco\n,Produto Demo,abc\nBebidas,Produto Demo,10\n", "utf8");
  const workbook = await readTabularFile(csv);
  const catalog = normalizeCatalog([workbook], {});
  const audit = auditData({ workbooks: [workbook], catalogData: catalog, orderData: { orders: [] } });

  assert.equal(audit.products_found, 2);
  assert.equal(audit.invalid_prices, 1);
  assert.equal(audit.duplicate_names, 1);
});

test("normalizacao de pedidos anonimiza dados pessoais", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "muller-tool-orders-"));
  const csv = path.join(dir, "pedidos.csv");
  await fs.writeFile(csv, "Data,Nome,Telefone,Quarto,Total,Status\n05/07/2026,Hospede Demo,telefone-demo,D-101,R$ 9,00,received\n", "utf8");
  const workbook = await readTabularFile(csv);
  const orders = normalizeOrders([workbook], {});

  assert.equal(orders.orders.length, 1);
  assert.equal(orders.orders[0].guest_name_redacted, "[DADO PESSOAL REDIGIDO]");
  assert.equal(orders.orders[0].phone_redacted, "[DADO PESSOAL REDIGIDO]");
  assert.equal(orders.orders[0].room_code_redacted, "[DADO PESSOAL REDIGIDO]");
});

test("dry-run gera SQL parametrizado sem valores embutidos", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "muller-tool-plan-"));
  const csv = path.join(dir, "catalogo.csv");
  await fs.writeFile(csv, "Categoria,Produto,Preco\nBebidas,Suco Demo,R$ 12,50\n", "utf8");
  const workbook = await readTabularFile(csv);
  const catalog = normalizeCatalog([workbook], {});
  const plan = buildImportPlan({ catalogData: catalog });

  assert.match(plan.sql_preview, /VALUES \(\?, \?,/);
  assert.doesNotMatch(plan.sql_preview, /Suco Demo/);
  assert.equal(plan.parameters.some((entry) => entry.values.includes("Suco Demo")), true);
});

test("serializador SQLite escapa texto, JSON, Unicode e bloqueia NUL", () => {
  assert.equal(sqliteLiteral("Cafe 'demo'"), "'Cafe ''demo'''");
  assert.equal(sqliteLiteral("linha 1\nlinha 2"), "'linha 1\nlinha 2'");
  assert.equal(sqliteLiteral("Acentos e emoji: acai ☕"), "'Acentos e emoji: acai ☕'");
  assert.equal(sqliteLiteral(null), "NULL");
  assert.equal(sqliteLiteral(true), "1");
  assert.equal(sqliteLiteral(1250), "1250");
  assert.equal(sqliteJsonLiteral({ texto: "valor 'seguro'", lista: [1, null] }), "'{\"texto\":\"valor ''seguro''\",\"lista\":[1,null]}'");
  assert.throws(() => sqliteLiteral("texto\0bloqueado"), /NUL/);
  assert.throws(() => sqliteLiteral(12.5), /inteiros/);
});

test("SQL executavel trata injecao como dado, remove links externos e preserva assets locais", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "muller-tool-exec-"));
  const csv = path.join(dir, "catalogo.csv");
  await fs.writeFile(
    csv,
    [
      "Categoria;Produto;Descricao;Preco;Disponivel;Imagem",
      "Bebidas;Cafe Especial;\"text'); DROP TABLE orders; --\";R$ 12,50;sim;https://drive.example.invalid/imagem-privada",
      "Bebidas;Cha Demo;Linha 1 / Linha 2;R$ 13,00;sim;/assets/hotels/muller-fioreze/cha-demo.png",
      "Bebidas;Cha Demo;Variante indisponivel;R$ 14,00;nao;",
    ].join("\n"),
    "utf8",
  );

  const workbook = await readTabularFile(csv);
  const catalog = normalizeCatalog([workbook], {});
  const importPackage = buildExecutableCatalogImportPackage({
    catalogData: catalog,
    inputHashes: [{ file_name: "catalogo.csv", sha256: "hash-ficticio" }],
    gitHead: "HEAD_FICTICIO",
    archiveMissing: true,
    generatedAt: "2026-07-05T12:00:00.000Z",
  });

  assert.match(importPackage.applySql, /DROP TABLE orders; --/);
  assert.match(importPackage.applySql, /text''\); DROP TABLE orders; --/);
  assert.doesNotMatch(importPackage.applySql, /drive\.example/);
  assert.match(importPackage.applySql, /\/assets\/hotels\/muller-fioreze\/cha-demo\.png/);
  assert.equal(importPackage.manifest.counts.products, 3);
  assert.equal(importPackage.manifest.counts.unavailable, 1);
  assert.equal(importPackage.manifest.counts.duplicate_name_groups, 1);
  assert.equal(importPackage.manifest.counts.records_to_archive, 3);
  assert.equal(importPackage.manifest.guarantees.orders_untouched, true);
});

test("pacote executavel e idempotente, preserva created_at, arquiva ausentes e faz rollback logico", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "muller-tool-validation-"));
  const csv = path.join(dir, "catalogo.csv");
  await fs.writeFile(
    csv,
    "Categoria;Produto;Descricao;Preco;Disponivel;Imagem\nBebidas;Suco Demo;Item ficticio;R$ 12,50;sim;/assets/demo/suco.png\nLanches;Sanduiche Demo;Item ficticio;R$ 25,00;nao;\n",
    "utf8",
  );
  const workbook = await readTabularFile(csv);
  const catalog = normalizeCatalog([workbook], {});
  const importPackage = buildExecutableCatalogImportPackage({
    catalogData: catalog,
    inputHashes: [{ file_name: "catalogo.csv", sha256: "hash-ficticio" }],
    gitHead: "HEAD_FICTICIO",
    archiveMissing: true,
    generatedAt: "2026-07-05T12:00:00.000Z",
  });
  const validation = await validateCatalogImportPackage({
    applySql: importPackage.applySql,
    rollbackSql: importPackage.rollbackSql,
    manifest: importPackage.manifest,
    repoRoot,
    outputDatabasePath: path.join(dir, "validation.sqlite"),
  });

  assert.equal(validation.ok, true);
  assert.equal(validation.after_first_apply.imported_products, 2);
  assert.equal(validation.after_first_apply.imported_available_products, 1);
  assert.equal(validation.after_first_apply.imported_unavailable_products, 1);
  assert.equal(validation.after_first_apply.archived_missing_items, 3);
  assert.equal(validation.checks.second_apply_same_counts_ok, true);
  assert.equal(validation.checks.created_at_preserved_on_second_apply_ok, true);
  assert.equal(validation.checks.aurora_untouched_ok, true);
  assert.equal(validation.checks.orders_untouched_ok, true);
  assert.equal(validation.checks.order_items_untouched_ok, true);
  assert.equal(validation.checks.rollback_functional_state_ok, true);
});

test("IDs permanecem estaveis e .gitignore bloqueia entradas e saidas reais", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "muller-tool-stable-"));
  const csv = path.join(dir, "catalogo.csv");
  await fs.writeFile(csv, "Categoria,Produto,Preco\nBebidas,Suco Demo,R$ 12,50\n", "utf8");
  const first = normalizeCatalog([await readTabularFile(csv)], {});
  const second = normalizeCatalog([await readTabularFile(csv)], {});
  assert.deepEqual(first.items.map((item) => item.id), second.items.map((item) => item.id));

  const gitignore = await fs.readFile(path.join(repoRoot, ".gitignore"), "utf8");
  assert.match(gitignore, /^local-input\/$/m);
  assert.match(gitignore, /^local-output\/$/m);
});

function createMinimalXlsx() {
  const entries = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cardapio" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Categoria</t></is></c><c r="B1" t="inlineStr"><is><t>Produto</t></is></c><c r="C1" t="inlineStr"><is><t>Preco</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Bebidas</t></is></c><c r="B2" t="inlineStr"><is><t>Produto Demo</t></is></c><c r="C2"><v>9.9</v></c><c r="D2"><f>C2*1</f><v>9.9</v></c></row></sheetData></worksheet>`,
  };
  return buildZip(entries);
}

function buildZip(entries) {
  const fileParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    fileParts.push(local, nameBytes, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...fileParts, central, end]);
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}
