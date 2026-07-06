# Runbook de importacao do catalogo Muller

Este runbook descreve a preparacao e a aplicacao futura do catalogo real do Room Service Muller no D1 de desenvolvimento. A geracao local do pacote nao aplica SQL, nao acessa Google Sheets remoto, nao executa Apps Script, nao acessa impressao e nao modifica o sistema legado.

## 1. Preparacao

1. Trabalhar em uma branch dedicada.
2. Confirmar que `local-input/` e `local-output/` estao ignorados pelo Git.
3. Colocar arquivos reais somente em `local-input/muller/`, quando necessario.
4. Executar a geracao em modo dry-run:

```bash
node tools/migration/muller-room-service/generate-import.js \
  --spreadsheet local-input/muller/cardapio.xlsx \
  --hotel muller-fioreze \
  --module room-service \
  --output-format executable-sql \
  --archive-missing \
  --dry-run
```

5. Confirmar que os arquivos gerados ficaram somente em `local-output/muller/catalog-import/`.

## 2. Revisao

Revisar estes arquivos locais, sem versiona-los:

- `catalog.manifest.json`
- `catalog.validation.json`
- `catalog.before.expected.json`
- `catalog.after.expected.json`
- `catalog.apply.sql`
- `catalog.rollback.sql`

Conferir obrigatoriamente:

- `hotel_id=muller-fioreze`;
- `module_key=room-service`;
- hashes dos arquivos de entrada;
- HEAD do Git;
- quantidade de categorias;
- quantidade de produtos;
- produtos disponiveis e indisponiveis;
- produtos sem imagem;
- nomes duplicados mantidos separados;
- itens ficticios candidatos a arquivamento;
- tabelas afetadas;
- tabelas proibidas;
- hashes de apply e rollback;
- validacao local com apply, segunda aplicacao e rollback.

## 3. Backup

Antes de qualquer aplicacao remota futura:

1. Confirmar a conta Cloudflare autorizada.
2. Confirmar o D1 de desenvolvimento:
   - `database_name=fioreze-portais-db-dev`
   - `database_id=883e953a-4280-454b-8aed-a3148f8008f1`
3. Obter snapshot ou exportacao aprovada do estado anterior.
4. Guardar o snapshot em local seguro fora do Git.
5. Conferir que o rollback foi gerado antes do apply.

## 4. Aplicacao Remota Futura

A aplicacao remota nao esta autorizada por este documento. Quando houver autorizacao explicita:

1. Usar somente o `catalog.apply.sql` revisado.
2. Aplicar somente no D1 de desenvolvimento autorizado.
3. Nao aplicar migrations improvisadas.
4. Nao executar seed.
5. Nao tocar em producao.
6. Nao acessar Apps Script, Google Sheets ou impressao.
7. Registrar o comando exato antes da escrita.

## 5. Validacao

Apos uma aplicacao futura autorizada, validar:

- 1 catalogo ativo para Muller Room Service;
- categorias esperadas;
- produtos esperados;
- produtos disponiveis e indisponiveis;
- itens antigos ausentes arquivados logicamente;
- nenhum item Aurora alterado;
- nenhum item de outro modulo alterado;
- `orders` intacto;
- `order_items` intacto;
- frontend carregando categorias, cards e carrinho;
- impressao permanecendo desativada.

## 6. Rollback

Se a validacao falhar:

1. Interromper novas escritas.
2. Preservar logs e manifest localmente, fora do Git.
3. Revisar `catalog.rollback.sql`.
4. Aplicar rollback somente com autorizacao explicita.
5. Validar o retorno funcional ao estado anterior esperado.
6. Confirmar que pedidos e itens de pedidos nao foram alterados.

O rollback deve ser logico. Ele nao deve apagar `catalog_items` que possam ser referenciados por pedidos.

## 7. Criterios de Interrupcao

Parar antes de qualquer escrita se ocorrer qualquer uma destas condicoes:

- conta Cloudflare diferente da autorizada;
- D1 diferente do autorizado;
- hashes de input divergentes dos revisados;
- manifest com `hotel_id` ou `module_key` incorretos;
- SQL contendo `DELETE` em tabelas de catalogo;
- SQL tocando `orders`, `order_items`, `print_events`, usuarios ou sessoes;
- URLs privadas ou credenciais em arquivos versionados;
- falha na validacao local;
- contagem inesperada de categorias, produtos ou indisponiveis;
- tentativa de acesso a Apps Script, Sheets, impressao, DNS ou producao.
