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
- `migrations/`: SQL versionado.
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
- configuracoes publicas;
- feature flags publicas;
- status de servicos;
- base publica de assets.

Nao retorna usuarios, permissoes, tokens, segredos ou configuracoes internas.

## Banco

Tabelas principais:

- core: `hotels`, `hotel_domains`, `hotel_branding`, `hotel_settings`, `modules`, `hotel_modules`, `navigation_items`, `features`, `hotel_features`, `rooms`;
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
- `/api/v1/admin/*` protegido por autenticacao

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
- branding;
- modulos habilitados e desabilitados;
- produtos;
- pedido valido;
- preco, subtotal e total adulterados;
- produto inexistente, indisponivel, arquivado, de outro hotel e de outro modulo;
- isolamento por hotel;
- rota admin sem autenticacao;
- impressao desativada.

## Autenticacao

Login definitivo ainda nao existe. Todas as rotas administrativas retornam `401`. A estrategia futura usa WebCrypto, hash seguro de senha, hash de token de sessao, cookies seguros e acesso por hotel, role e permission.

## Impressao

Impressao permanece desativada com `IMPRESSION_ENABLED=false`. O `PrintProvider` e apenas uma interface inicial. Nenhuma rota chama servidor antigo, Python, localhost, impressora, Apps Script ou planilha.

## Ainda Falta Migrar

- Portal do Hospede completo;
- Emporio funcional;
- Spa funcional;
- Pacotes Romanticos funcionais;
- ERP administrativo completo;
- login e sessoes definitivas;
- painel de pedidos;
- integracao futura de impressao;
- deploy Cloudflare;
- dados reais via processo controlado de migracao.

## Restricoes

Esta fase nao acessou producao, D1 remoto, Cloudflare remoto, Apps Script, Google Sheets, servidor de impressao ou impressoras.
