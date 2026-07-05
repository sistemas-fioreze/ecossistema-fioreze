# Ferramenta de migracao - Room Service Muller

Ferramenta offline para inventariar, normalizar e validar dados do Room Service Muller antes de qualquer importacao para a plataforma Cloudflare Worker + D1.

## Regras de seguranca

- Nao acessa Google Sheets remoto.
- Nao executa Apps Script.
- Nao chama endpoints antigos.
- Nao acessa impressao.
- Nao escreve no D1 local ou remoto.
- Nao usa credenciais.
- Nao depende de caminhos absolutos.
- Gera saidas somente em `local-output/muller/`, pasta ignorada pelo Git.

## Entradas aceitas

- `.xlsx`
- `.csv`
- `.tsv`
- `.json`
- `.gs` ou `.txt` para analise estatica do Apps Script

## Comandos

Inventario local:

```bash
node tools/migration/muller-room-service/inspect-input.js \
  --spreadsheet local-input/muller/cardapio.xlsx \
  --apps-script local-input/muller/room-service-appscript.txt
```

Normalizacao do catalogo:

```bash
node tools/migration/muller-room-service/normalize-catalog.js \
  --spreadsheet local-input/muller/cardapio.xlsx \
  --hotel muller-fioreze \
  --module room-service
```

Validacao e auditoria:

```bash
node tools/migration/muller-room-service/validate-data.js \
  --spreadsheet local-input/muller/cardapio.xlsx \
  --apps-script local-input/muller/room-service-appscript.txt
```

Dry-run de importacao:

```bash
node tools/migration/muller-room-service/generate-import.js \
  --spreadsheet local-input/muller/cardapio.xlsx \
  --hotel muller-fioreze \
  --module room-service \
  --dry-run
```

## Saidas locais

Possiveis arquivos em `local-output/muller/`:

- `input-inspection.json`
- `catalog.normalized.json`
- `orders.anonymized.json`
- `validation-report.json`
- `data-audit.json`
- `import-preview.sql`
- `import-preview.parameters.json`

Esses arquivos podem conter dados reais ou derivados de dados reais quando a entrada real for usada. Eles nao devem ser versionados.

## Estrategia de SQL

O dry-run gera SQL com placeholders (`?`) e parametros separados. A ferramenta nao executa SQL e nao conecta ao D1.

## Dados pessoais

Pedidos e historico sao tratados como dados de risco. A normalizacao de pedidos gera apenas versao anonimizada, com campos pessoais substituidos por marcadores.

## Testes

Os testes usam somente dados ficticios:

```bash
npm --prefix tools/migration/muller-room-service test
```
