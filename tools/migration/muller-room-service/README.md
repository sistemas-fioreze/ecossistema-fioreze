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

Geracao do pacote executavel e auditavel de catalogo:

```bash
node tools/migration/muller-room-service/generate-import.js \
  --spreadsheet local-input/muller/cardapio.xlsx \
  --hotel muller-fioreze \
  --module room-service \
  --output-format executable-sql \
  --archive-missing \
  --dry-run
```

Mesmo nesse modo, `--dry-run` significa que a ferramenta nao aplica SQL, nao conecta ao D1 e nao faz chamadas externas.

Geracao futura com snapshot anterior real ja coletado:

```bash
node tools/migration/muller-room-service/generate-import.js \
  --spreadsheet local-input/muller/cardapio.xlsx \
  --hotel muller-fioreze \
  --module room-service \
  --output-format executable-sql \
  --archive-missing \
  --before-state local-input/muller/d1-before-state.json \
  --dry-run
```

O arquivo `--before-state` deve conter somente o estado anterior das tabelas `catalogs`, `categories`, `catalog_items` e `catalog_item_availability`, limitado a `hotel_id=muller-fioreze` e `module_key=room-service`. Snapshots com pedidos, usuarios, sessoes, impressao, outros hoteis, outros modulos, URLs externas, dados pessoais ou segredos sao rejeitados.

## Saidas locais

Possiveis arquivos em `local-output/muller/`:

- `input-inspection.json`
- `catalog.normalized.json`
- `orders.anonymized.json`
- `validation-report.json`
- `data-audit.json`
- `import-preview.sql`
- `import-preview.parameters.json`

Arquivos do pacote executavel em `local-output/muller/catalog-import/`:

- `catalog.apply.sql`
- `catalog.fixture-rollback.sql`
- `catalog.snapshot-query.sql`
- `catalog.manifest.json`
- `catalog.validation.json`
- `catalog.before.expected.json`
- `catalog.after.expected.json`
- `catalog-validation.sqlite`

`catalog.rollback.sql` so e gerado quando `--before-state` valido e fornecido. Sem snapshot anterior real, esse arquivo nao deve existir.

Esses arquivos podem conter dados reais ou derivados de dados reais quando a entrada real for usada. Eles nao devem ser versionados.

## Estrategia de SQL

O dry-run gera SQL com placeholders (`?`) e parametros separados. A ferramenta nao executa SQL e nao conecta ao D1.

O modo `--output-format executable-sql` gera SQL SQLite revisavel para uma etapa futura. Ele usa apenas tabelas e colunas internas permitidas, serializa literais SQLite com escape de aspas, valida JSON, bloqueia caracteres NUL e trata formulas ou texto parecido com SQL como dados comuns. Nomes de tabela e coluna nunca vem da planilha.

### Idempotencia

O `catalog.apply.sql` usa `INSERT ... ON CONFLICT ... DO UPDATE` e preserva `created_at` em registros existentes. Ele atualiza apenas campos permitidos de catalogo, categorias, produtos e disponibilidade. Com `--archive-missing`, itens ativos antigos do escopo `hotel_id=muller-fioreze` e `module_key=room-service` que nao estejam no catalogo importado sao arquivados logicamente, sem `DELETE`.

### Rollback

Existem dois tipos de rollback:

- `catalog.fixture-rollback.sql`: usado somente em SQLite temporario, fixtures ficticias e testes automatizados. Ele nunca deve ser aplicado no D1 remoto.
- `catalog.rollback.sql`: gerado somente quando `--before-state` valido for fornecido. Ele e baseado no snapshot anterior real, restaura os registros antigos e arquiva logicamente registros introduzidos pela importacao.

Sem `--before-state`, o manifesto marca `remote_apply_ready=false`, `remote_rollback_ready=false` e `rollback_source=fixture-validation-only`. Isso bloqueia a aplicacao remota ate existir snapshot real anterior do D1.

O rollback remoto nao apaga pedidos, nao altera `orders`, nao altera `order_items`, nao toca no Aurora e nao usa `DELETE` em `catalog_items`.

### Validacao local

O gerador cria um SQLite temporario em `local-output/muller/catalog-import/catalog-validation.sqlite`, aplica as migrations atuais, carrega uma fixture ficticia quando nao ha snapshot real, executa o apply, executa o apply novamente e depois executa o rollback adequado para o modo. O resultado resumido fica em `catalog.validation.json`.

Verificacoes feitas:

- contagens de catalogo, categorias, produtos e disponibilidade;
- idempotencia da segunda aplicacao;
- preservacao de `created_at`;
- arquivamento de itens ausentes no escopo Muller Room Service;
- Aurora intacto;
- `orders` e `order_items` intactos;
- rollback funcional para o estado ficticio inicial, quando sem `--before-state`;
- rollback baseado no snapshot anterior validado, quando com `--before-state`.

### Snapshot anterior

O arquivo `catalog.snapshot-query.sql` contem apenas `SELECTs` para coletar o estado anterior das quatro tabelas permitidas. Ele e gerado para revisao futura, mas nao e executado por esta ferramenta.

Formato esperado do `--before-state`:

```json
{
  "format_version": "muller-catalog-before-state/v1",
  "hotel_id": "muller-fioreze",
  "module_key": "room-service",
  "tables": {
    "catalogs": [],
    "categories": [],
    "catalog_items": [],
    "catalog_item_availability": []
  }
}
```

### Imagens

A importacao so preserva `image_url` que ja comece com `/assets/`. Links HTTP/HTTPS e referencias de Drive nao sao gravados em `image_url`, nao sao baixados e nao entram no manifesto com URL completa. Quando houver referencia externa, a ferramenta registra apenas um hash tecnico em `metadata_json`.

### Revisao do manifesto

Antes de qualquer aplicacao futura, revise `catalog.manifest.json` e confirme:

- `hotel_id` igual a `muller-fioreze`;
- `module_key` igual a `room-service`;
- hashes dos arquivos de entrada;
- HEAD do Git;
- contagens de categorias, produtos, disponiveis e indisponiveis;
- itens candidatos a arquivamento;
- tabelas afetadas;
- tabelas explicitamente proibidas;
- `remote_apply_ready`;
- `remote_rollback_ready`;
- `rollback_source`;
- hashes de `catalog.apply.sql`, `catalog.fixture-rollback.sql`, `catalog.snapshot-query.sql` e, quando existir, `catalog.rollback.sql`.

### Aplicacao futura no D1

Esta ferramenta nao aplica SQL remotamente. Quando houver autorizacao especifica em outra tarefa, a aplicacao devera usar apenas o SQL gerado e revisado, contra o D1 de desenvolvimento correto, depois de backup/snapshot real e com `catalog.rollback.sql` gerado a partir desse snapshot. Nunca use `catalog.fixture-rollback.sql` no D1 remoto.

## Dados pessoais

Pedidos e historico sao tratados como dados de risco. A normalizacao de pedidos gera apenas versao anonimizada, com campos pessoais substituidos por marcadores.

## Testes

Os testes usam somente dados ficticios:

```bash
npm --prefix tools/migration/muller-room-service test
```
