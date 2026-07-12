# Plataforma Fioreze App

Aplicacao nova e compartilhada do ecossistema digital da Familia Fioreze.

## Visao

Um unico Worker, um unico front-end publico, uma unica autenticacao administrativa e um unico banco D1 multi-hotel. O Muller e Fioreze e o primeiro tenant e Room Service e o primeiro modulo funcional, mas a base suporta Portal do Hospede, Emporio, Spa, Pacotes Romanticos, Central de Portais e modulos futuros.

## Arquitetura

- `public/index.html`: shell publico unico.
- `public/admin/index.html`: central de acesso administrativo.
- `public/admin/room-service/index.html`: ERP operacional do Room Service.
- `public/admin/portais/index.html`: fundacao visual da Central de Portais Fioreze.
- `src/core/`: roteamento, D1, tenant, bootstrap, validacao, respostas e feature flags.
- `src/middleware/`: autenticacao, autorizacao, modulo habilitado e headers.
- `src/modules/`: regras e rotas por modulo.
- `migrations/`: SQL versionado em diretorio plano, com ordem pelo prefixo numerico global.
- `seeds/dev.sql`: dados ficticios locais.
- `tests/`: testes locais com D1 mockado.
- `scripts/`: validacoes locais e utilitarios.

## Front-end

O shell publico identifica o hotel pelo slug da URL, chama `/api/v1/public/hotels/:hotel_slug/bootstrap`, aplica branding, monta a navegacao e carrega o modulo. Ele nao baixa HTML remoto.

As telas administrativas tambem compartilham o mesmo backend, usuario, cookie `fioreze_admin_session`, logout e endpoint `GET /api/v1/admin/session`. O frontend fica separado em duas aplicacoes administrativas independentes:

- ERP Room Service, focado em operacao de pedidos e atendimento;
- Central de Portais Fioreze, preparada para administracao de hoteis, portais, conteudos e usuarios.

Rotas administrativas:

- `/admin/`: central de acesso administrativo e selecao de sistemas;
- `/admin/room-service/`: ERP operacional do Room Service;
- `/admin/portais/`: Central de Portais Fioreze.

Autorizacao visual usa `permission_key` retornada pela sessao e acesso por hotel retornado pelo backend. A barreira efetiva permanece nas APIs administrativas.

Rotas publicas planejadas:

- `/muller-fioreze`
- `/muller-fioreze/room-service`
- `/muller-fioreze/emporio`
- `/muller-fioreze/spa`
- `/muller-fioreze/romantic-packages`

## Bootstrap

`GET /api/v1/public/hotels/:hotel_slug/bootstrap` retorna somente dados publicos:

- hotel;
- branding;
- modulos habilitados;
- navegacao;
- horarios publicos em `service_hours`;
- configuracoes publicas;
- feature flags publicas;
- status de servicos;
- base publica de assets.

Nao retorna usuarios, permissoes, tokens, segredos ou configuracoes internas.

## Banco

Tabelas principais:

- core: `hotels`, `hotel_domains`, `hotel_branding`, `hotel_settings`, `modules`, `hotel_modules`, `navigation_items`, `features`, `hotel_features`, `rooms`, `service_hours`, `media_assets`;
- admin: `admin_users`, `admin_roles`, `admin_permissions`, `admin_user_roles`, `admin_role_permissions`, `admin_hotel_access`, `admin_sessions`, `admin_audit_log`;
- portal: `portal_pages`, `portal_sections`, `portal_content_items`, `events`, `hotel_information`;
- catalogos: `catalogs`, `categories`, `catalog_items`, `catalog_item_availability`;
- pedidos: `orders`, `order_items`, `order_status_history`, `print_events`;
- spa: `spa_services`, `spa_service_requests`, `spa_appointments`;
- pacotes: `romantic_packages`, `romantic_package_requests`.

## Endpoints

Implementados:

- `GET /api/v1/health`
- `GET /api/v1/public/hotels/:hotel_slug/bootstrap`
- `GET /api/v1/public/hotels/:hotel_slug/modules`
- `GET /api/v1/public/hotels/:hotel_slug/room-service/products`
- `POST /api/v1/public/hotels/:hotel_slug/room-service/orders`
- `POST /api/v1/admin/login`
- `POST /api/v1/admin/logout`
- `GET /api/v1/admin/session`
- `GET /api/v1/admin/hotels`
- `GET /api/v1/admin/orders`
- `GET /api/v1/admin/orders/:id`
- `POST /api/v1/admin/orders/:id/status`
- `POST /api/v1/admin/media`
- `GET /api/v1/admin/media`
- `GET /api/v1/admin/media/:id`
- `PATCH /api/v1/admin/media/:id`
- `DELETE /api/v1/admin/media/:id`
- `GET /media/:id`
- `HEAD /media/:id`

Contratos futuros:

- Emporio: items e orders;
- Spa: services e requests;
- Portal: pages e events;
- Pacotes Romanticos: packages e requests.

## Variaveis

`.dev.vars.example` contem:

```text
ENVIRONMENT=development
IMPRESSION_ENABLED=false
DEFAULT_HOTEL_SLUG=muller-fioreze
```

Nao colocar credenciais reais em `.dev.vars`, `wrangler.jsonc` ou seeds.

O `wrangler.jsonc` de desenvolvimento declara o binding R2:

```jsonc
"r2_buckets": [
  {
    "binding": "MEDIA_BUCKET",
    "bucket_name": "fioreze-portais-media-dev"
  }
]
```

Nao usar `remote=true`, `r2.dev`, dominio publico de bucket, bucket de producao ou chaves S3 nesta fase. O acesso publico deve passar pelo Worker em `/media/:id`.

## Comandos Locais

```bash
npm install
npm run validate
npm test
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Todos os scripts D1 usam modo local. Nao ha scripts remotos nesta fase.

## Migrations E Seeds Locais

As migrations D1 executaveis ficam diretamente em `app/migrations/`. O Wrangler usa `migrations/*.sql`, entao a ordem deve ser definida pelo prefixo numerico global: `0001`, `0002`, `0003` e assim por diante. Modulos nao devem criar sequencias independentes em subpastas.

A migration `0007_core_service_hours_media_assets.sql` e incremental porque `0001` a `0006` ja foram aplicadas no D1 remoto de desenvolvimento. Migrations ja aplicadas nao devem ser editadas; qualquer mudanca posterior de schema deve criar a proxima migration global.

`service_hours` e a fonte canonica de horarios operacionais por hotel e modulo. Ela permite varias faixas por dia usando `sort_order`; o timezone vem de `hotels.timezone`.

`media_assets` guarda metadados de midia e assets. O D1 nao armazena binarios. O seed usa assets `static` sanitizados, e a Biblioteca de Imagens usa R2 para binarios.

A migration `0008_media_library_foundation.sql` prepara a Biblioteca de Imagens:

- metadados adicionais em `media_assets`: nome original sanitizado, tamanho, SHA-256, ETag, usuario de upload e usuario de arquivamento;
- indices por `hotel_id/status/created_at`, checksum e usuario de upload;
- permissoes `portals.media.read`, `portals.media.upload`, `portals.media.update` e `portals.media.archive`;
- nenhuma permissao e atribuida a roles pela migration.

Como `ALTER TABLE ... ADD COLUMN` no D1/SQLite nao e uma forma segura de adicionar foreign keys em colunas novas, `uploaded_by_user_id` e `archived_by_user_id` ficam nullable e a integridade e validada pela aplicacao. Uma migration futura pode reconstruir a tabela se uma FK fisica for necessaria.

Aplicar migrations:

```bash
npm run db:migrate:local
```

Aplicar dados ficticios:

```bash
npm run db:seed:local
```

Reset local exige confirmacao:

```bash
CONFIRM_LOCAL_DB_RESET=yes npm run db:reset:local
```

## Testes

Os testes cobrem:

- saude;
- hotel existente e inexistente;
- bootstrap;
- horarios publicos em `service_hours`;
- branding;
- modulos habilitados e desabilitados;
- produtos;
- pedido valido;
- preco, subtotal e total adulterados;
- produto inexistente, indisponivel, arquivado, de outro hotel e de outro modulo;
- isolamento por hotel;
- rota admin sem autenticacao;
- roteamento administrativo separado para central, Room Service e Portais;
- login, logout, sessao expirada e cookies administrativos;
- listagem e detalhe de pedidos limitados aos hoteis permitidos;
- transicoes de status, idempotencia, concorrencia, historico e auditoria;
- impressao desativada;
- Biblioteca de Imagens com R2 mockado localmente;
- validacao de upload JPEG, PNG, WebP, MIME, magic bytes, tamanho e arquivamento logico.

## Biblioteca De Imagens

A Central de Portais possui a rota `/admin/portais/media/`. Ela e um MVP administrativo para imagens publicas de hoteis e modulos, usando:

- D1 para metadados em `media_assets`;
- R2 para binarios via binding `MEDIA_BUCKET`;
- rota publica segura `/media/:id`, com bucket privado e sem expor `object_key`;
- `public_url` relativo e estavel no formato `/media/<asset_id>`;
- `object_key` gerado exclusivamente no servidor como `hotels/<hotel_id>/<module_or_shared>/<yyyy>/<mm>/<asset_id>.<ext>`.

Formatos aceitos:

- `image/jpeg`;
- `image/png`;
- `image/webp`;
- `image/avif`.

Limite inicial: 8MB por arquivo. SVG e arquivos vazios sao rejeitados. O Worker valida `Content-Type`, extensao, tamanho real e magic bytes, calcula SHA-256 e sanitiza `original_filename`, `alt_text` e `module_key`.

Permissoes administrativas:

- `portals.media.read`: listar e visualizar biblioteca;
- `portals.media.upload`: enviar imagem;
- `portals.media.update`: alterar `alt_text` e `module_key`;
- `portals.media.archive`: arquivar logicamente.

Arquivamento nao apaga o objeto R2. Imagens arquivadas retornam 404 em `/media/:id`. Falha de metadados D1 depois de um `put` no R2 aciona compensacao local, removendo o objeto recem-enviado antes de retornar erro seguro.

Como Static Assets usa `not_found_handling: single-page-application`, o `wrangler.jsonc` precisa manter `/media/*` em `assets.run_worker_first`, junto de `/api/*` e `/admin/*`. Sem isso, a borda da Cloudflare poderia entregar o fallback HTML antes da rota do Worker. Os testes locais chamam o export do Worker diretamente, entao nao reproduzem completamente a precedencia da borda; por isso tambem existe teste de configuracao para garantir `/media/*` em `run_worker_first`.

Comandos futuros, nao executados nesta implementacao:

```bash
wrangler r2 bucket create fioreze-portais-media-dev
wrangler d1 migrations apply fioreze-portais-db-dev --remote
wrangler deploy
```

Antes de qualquer uso remoto, esses comandos precisam de autorizacao explicita e novo preflight. Um dominio de midia dedicado pode ser adicionado no futuro, mas nao deve substituir a regra de bucket privado sem revisao.

Fora do escopo atual:

- redimensionamento;
- compressao;
- remocao de EXIF;
- variantes responsivas;
- R2 lifecycle;
- delecao fisica por UI.

## Autenticacao

O MVP administrativo implementa login real para ambiente local e desenvolvimento controlado:

- senha armazenada como PBKDF2-SHA-256 serializado em `admin_users.password_hash`;
- hashes administrativos devem usar exatamente 100000 iteracoes PBKDF2, limite aceito pelo runtime do Worker nesta implementacao;
- token de sessao gerado com WebCrypto e armazenado somente como `token_hash`;
- cookie `fioreze_admin_session` com `HttpOnly`, `SameSite=Lax` e `Secure` quando a requisicao usa HTTPS;
- sessoes expiram e podem ser revogadas no logout;
- o cabecalho `x-fioreze-test-now` so e aceito quando `ENVIRONMENT=test`;
- POSTs administrativos autenticados exigem origem same-origin, quando `Origin` existir, e o cabecalho `x-fioreze-admin-action: erp-admin`;
- acesso por hotel vem de `admin_hotel_access`;
- permissoes usadas pelo MVP:
  - `room-service.orders.read`;
  - `room-service.orders.write`;
- `portals.media.read`;
- `portals.media.upload`;
- `portals.media.update`;
- `portals.media.archive`;
- `portals.embed.read`;
- `portals.embed.update`.

As permissoes de midia sao cadastradas pela migration `0008`, mas nao sao associadas automaticamente a nenhum role. A liberacao de usuarios no D1 de desenvolvimento deve ser uma etapa operacional separada e autorizada.

O cartao Room Service da central aparece para usuarios com `room-service.orders.read`. A Central de Portais aparece somente para usuarios com permissoes futuras prefixadas por `platform.` ou `portals.`. Nao ha autorizacao por e-mail, nome de usuario ou regra fixa no frontend.

Credenciais ficticias do seed local:

```text
E-mail: admin-demo@example.invalid
Senha: DemoAdmin!2026
```

Essas credenciais sao somente para desenvolvimento local. Nao usar dados reais em seeds, testes ou documentacao.

Quando `admin_users.force_password_change = 1`, o MVP bloqueia o login e nao cria sessao. A tela completa de redefinicao de senha ainda nao foi implementada; a resposta da API informa a necessidade de redefinir a senha sem expor hash, salt ou detalhes internos.

Hashes PBKDF2 com iteracoes fora do intervalo suportado sao tratados como credencial invalida antes da derivacao criptografica. Isso evita erro 500 em ambiente Workers e mantem a resposta sem detalhes sensiveis.

Fluxo local:

```bash
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Depois acesse `http://localhost:8787/admin/`.

## ERP Administrativo

O shell `/admin/` e uma central de acesso. Ele exibe, apos login:

- nome do usuario;
- hoteis autorizados;
- sistemas disponiveis conforme permissoes;
- logout compartilhado.

O shell `/admin/room-service/` exibe:

- tela de login;
- lista de pedidos de Room Service;
- filtros por hotel, status e busca;
- detalhe de pedido com itens, totais, historico e situacao de impressao;
- mudanca de status controlada.

O shell `/admin/portais/` e a Central de Portais Fioreze. O MVP atual inclui a area `/admin/portais/unidades/` para administrar unidades/hoteis de forma multi-hotel, com:

- listagem filtrada pelos hoteis autorizados ao usuario;
- criacao de unidade com `hotel_id` derivado do slug, sem aceitar `hotel_id` enviado pelo cliente;
- edicao de dados gerais, status e arquivamento logico;
- identidade visual com selecao de midias ja cadastradas na Biblioteca de Imagens;
- configuracoes publicas de contato, hospedagem e SEO em `hotel_settings`;
- ativacao de modulos por hotel em `hotel_modules`;
- navegacao publica por hotel em `navigation_items`;
- configuracao oficial de incorporacao publica em `hotel_settings`;
- auditoria administrativa em `admin_audit_log`.

As APIs de Unidades exigem sessao administrativa, permissoes `portals.hotels.*`, acesso explicito ao hotel, protecao de origem e header administrativo para mutacoes. A migration `0009_admin_units_management_permissions.sql` cadastra as permissoes, mas nao associa roles automaticamente. O seed local pode liberar essas permissoes para o usuario ficticio de desenvolvimento.

## Incorporacao Publica

O modo embed publica modulos publicos em iframes controlados, sem expor a Central Administrativa:

- `/embed/:hotel_slug/:module_key/`;
- `/embed/:hotel_slug/:module_key/embed.js`;
- `/embed/:hotel_slug/:module_key/config`;
- `/embed/fioreze-embed.js`;
- `/api/v1/public/hotels/:hotel_slug/embed/:module_key/config`.

A configuracao fica em `hotel_settings` usando chaves `embed.*`. A allowlist aceita somente origens completas, sem caminho e sem wildcard. `localhost` e permitido apenas em desenvolvimento/testes. O modulo `admin` nunca e incorporavel.

As respostas `/embed/*` nao usam `X-Frame-Options`; elas usam `Content-Security-Policy` com `frame-ancestors` derivado das origens autorizadas. Rotas `/admin/*` continuam protegidas contra iframe.

O script de autoaltura envia apenas `fioreze:embed:ready` e `fioreze:embed:resize` via `postMessage`. O script hospedeiro valida `event.origin`, `event.data.type` e `embed_id` antes de ajustar altura.

Exemplo local:

```html
<iframe
  data-fioreze-embed
  data-fioreze-embed-id="fioreze-muller-fioreze-room-service"
  src="http://localhost:8787/embed/muller-fioreze/room-service/"
  width="100%"
  height="560"
  loading="lazy"
  style="border:0;width:100%;max-width:100%;"></iframe>
<script src="http://localhost:8787/embed/fioreze-embed.js" defer></script>
```

Fluxo de status exposto pela API:

```text
received -> preparing -> ready -> completed
received|preparing|ready -> cancelled
```

Por compatibilidade com o schema atual, `completed` e persistido em `orders.status` como `delivered` e traduzido de volta para `completed` nas APIs administrativas. Uma migration futura pode alinhar o CHECK do banco para aceitar `completed` diretamente.

Cancelamento exige nota. Toda mudanca valida registra `order_status_history` e `admin_audit_log`. Repetir a mesma mudanca nao cria historico duplicado.

As mudancas de status usam `UPDATE` otimista pelo status anterior. Historico e auditoria usam `INSERT ... SELECT` condicionados ao pedido estar no status alvo, no mesmo hotel/modulo e com `updated_at` igual ao horario daquela requisicao. A API tambem verifica `meta.changes` do `UPDATE`: se zero linhas forem alteradas, os inserts condicionais nao devem gravar nada e a rota rele o pedido.

A migration `0007_admin_orders_guards.sql` adiciona o indice unico `uq_order_status_history_order_status` para garantir no banco que cada pedido tenha no maximo um historico por status. Antes de aplicar essa migration em qualquer D1 compartilhado, executar a pre-verificacao:

```sql
SELECT order_id, status, COUNT(*) AS total
FROM order_status_history
GROUP BY order_id, status
HAVING COUNT(*) > 1;
```

Se duas requisicoes simultaneas solicitarem o mesmo status, a vencedora grava status, historico e auditoria; a perdedora rele o pedido e retorna `idempotent=true` quando o status ja estiver aplicado. Se duas requisicoes concorrentes solicitarem destinos diferentes, apenas a vencedora grava historico/auditoria e a perdedora recebe `409 conflict` com o status atual. Nenhuma rota de status cria `print_events`.

## Impressao

Impressao permanece desativada com `IMPRESSION_ENABLED=false`. O `PrintProvider` e apenas uma interface inicial. Nenhuma rota chama servidor antigo, Python, localhost, impressora, Apps Script ou planilha.

No ERP, a mensagem exibida e `Impressao desativada neste ambiente.`. Mudar status nao cria `print_events` nem aciona qualquer recurso externo.

## Ainda Falta Migrar

- Portal do Hospede completo;
- Emporio funcional;
- Spa funcional;
- Pacotes Romanticos funcionais;
- ERP administrativo completo;
- filtros e painel de pedidos avancados;
- usuarios, roles e permissoes editaveis pelo ERP;
- integracao futura de impressao;
- deploy Cloudflare;
- dados reais via processo controlado de migracao.

## Restricoes

Esta fase nao acessou producao, D1 remoto, Cloudflare remoto, Apps Script, Google Sheets, servidor de impressao ou impressoras.
