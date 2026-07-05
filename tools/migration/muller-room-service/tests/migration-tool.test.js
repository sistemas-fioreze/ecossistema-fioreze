import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { normalizeCatalog } from "../lib/catalog.js";
import { auditData } from "../lib/data-quality.js";
import { buildImportPlan } from "../lib/import-plan.js";
import { normalizeMoneyToCents, normalizeBoolean, normalizeDateToIso } from "../lib/normalize.js";
import { normalizeOrders } from "../lib/orders.js";
import { readTabularFile } from "../lib/spreadsheet.js";

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
