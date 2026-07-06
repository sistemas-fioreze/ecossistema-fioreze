# Plataforma Fioreze App

Aplicacao nova e compartilhada do ecossistema digital da Familia Fioreze.

## Visao

Um unico Worker, um unico front-end publico, um unico ERP e um unico banco D1 multi-hotel. O Muller e Fioreze e o primeiro tenant e Room Service e o primeiro modulo funcional, mas a base suporta Portal do Hospede, Emporio, Spa, Pacotes Romanticos e modulos futuros.

## Arquitetura

- `public/index.html`: shell publico unico.
- `public/admin/index.html`: shell administrativo unico.
- `src/core/`: roteamento, D1, tenant, bootstrap, validacao, respostas e feature flags.
- `src/middleware/`: autenticacao, autorizacao, modulo habilitado e headers.
- `src/modules/`: regras e rotas por modulo.
- `migrations/`: SQL versionado em diretorio plano, com ordem pelo prefixo numerico global.
- `seeds/dev.sql`: dados ficticios locais.
- `tests/`: testes locais com D1 mockado.
- `scripts/`: validacoes locais e utilitarios.

## Front-end

O shell publico identifica o hotel pelo slug da URL, chama `/api/v1/public/hotels/:hotel_slug/bootstrap`, aplica branding, monta a navegacao e carrega o modulo. Ele nao baixa HTML remoto.

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

`media_assets` guarda metadados de midia e assets. O D1 nao armazena binarios. Nesta fase o seed usa assets `static` sanitizados; R2 e uma etapa futura.

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
- login, logout, sessao expirada e cookies administrativos;
- listagem e detalhe de pedidos limitados aos hoteis permitidos;
- transicoes de status, idempotencia, historico e auditoria;
- impressao desativada.

## Autenticacao

O MVP administrativo implementa login real para ambiente local e desenvolvimento controlado:

- senha armazenada como PBKDF2-SHA-256 serializado em `admin_users.password_hash`;
- token de sessao gerado com WebCrypto e armazenado somente como `token_hash`;
- cookie `fioreze_admin_session` com `HttpOnly`, `SameSite=Lax` e `Secure` quando a requisicao usa HTTPS;
- sessoes expiram e podem ser revogadas no logout;
- acesso por hotel vem de `admin_hotel_access`;
- permissoes usadas pelo MVP:
  - `room-service.orders.read`;
  - `room-service.orders.write`.

Credenciais ficticias do seed local:

```text
E-mail: admin-demo@example.invalid
Senha: DemoAdmin!2026
```

Essas credenciais sao somente para desenvolvimento local. Nao usar dados reais em seeds, testes ou documentacao.

Fluxo local:

```bash
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Depois acesse `http://localhost:8787/admin/`.

## ERP Administrativo

O shell `/admin/` exibe:

- tela de login;
- lista de pedidos de Room Service;
- filtros por hotel, status e busca;
- detalhe de pedido com itens, totais, historico e situacao de impressao;
- mudanca de status controlada.

Fluxo de status exposto pela API:

```text
received -> preparing -> ready -> completed
received|preparing|ready -> cancelled
```

Por compatibilidade com o schema atual, `completed` e persistido em `orders.status` como `delivered` e traduzido de volta para `completed` nas APIs administrativas. Uma migration futura pode alinhar o CHECK do banco para aceitar `completed` diretamente.

Cancelamento exige nota. Toda mudanca valida registra `order_status_history` e `admin_audit_log`. Repetir a mesma mudanca nao cria historico duplicado.

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
