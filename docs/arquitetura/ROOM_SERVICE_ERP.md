# ERP Room Service

O ERP Room Service oficial e uma aplicacao unica e reutilizavel para todas as unidades Fioreze.

## Rota

- Canonica: `/erp/room-service/`
- Compatibilidade temporaria: `/admin/room-service/*` redireciona com `308` para `/erp/room-service/*`

O ERP nao usa o shell visual da Central Administrativa. Usuarios operacionais usam uma sessao propria do ERP, separada da sessao da Central. Somente o administrador de desenvolvimento com a permissao `erp.master` pode atravessar da Central para todos os ERPs.

O shell operacional preserva a identidade visual do ERP legado sanitizado: navegacao lateral com SVGs locais, topbar, dashboard, PDV, pedidos, hospedes, faturamento, cardapio e configuracoes. A marcacao visual foi desacoplada de todos os handlers e endpoints antigos; um adaptador local liga os componentes exclusivamente as APIs administrativas da plataforma.

## Estrutura

- HTML: `app/public/erp/room-service/index.html`
- CSS: `app/public/css/modules/room-service-erp/`
- JS: `app/public/js/modules/room-service-erp/`

`legacy-tailwind.css` contem apenas as classes estaticas necessarias ao shell visual e e servido pelos Static Assets. Nao existe carregamento de Tailwind, icones, fontes ou scripts por CDN no navegador.

## Modulos Visuais

- Dashboard
- PDV Direto
- Pedidos
- Hospedes
- Faturamento
- Editor de Cardapio
- Configuracoes

PR 1 criou a fundacao visual e a rota canonica. PR 2 adiciona os contratos administrativos iniciais do ERP para contexto, dashboard, pedidos, PDV, hospedes, faturamento e catalogo, reutilizando o schema atual.

## APIs do ERP

- `GET /api/v1/admin/room-service/login-context`
- `POST /api/v1/admin/room-service/login`
- `POST /api/v1/admin/room-service/logout`
- `GET /api/v1/admin/room-service/session`
- `GET /api/v1/admin/room-service/context`
- `GET /api/v1/admin/room-service/dashboard`
- `GET /api/v1/admin/room-service/orders`
- `POST /api/v1/admin/room-service/orders`
- `GET /api/v1/admin/room-service/orders/:id`
- `POST /api/v1/admin/room-service/orders/:id/status`
- `GET /api/v1/admin/room-service/guests`
- `GET /api/v1/admin/room-service/billing`
- `GET /api/v1/admin/room-service/catalog`
- `GET /api/v1/admin/room-service/permissions`
- `GET /api/v1/admin/room-service/users`
- `POST /api/v1/admin/room-service/users`
- `PATCH /api/v1/admin/room-service/users/:id`
- `POST /api/v1/admin/room-service/users/:id/password`

As rotas aceitam a sessao operacional do ERP ou a sessao do administrador `erp.master`, validam acesso por unidade e mantem a impressao desativada.

O seletor e as sessoes do ERP consideram apenas unidades ativas, com Room Service habilitado e com ao menos um responsavel registrado em `admin_hotel_access`. Um tenant tecnico ou orfao pode continuar existindo para testes de isolamento sem aparecer como unidade operacional.

## Identidade por unidade

O ERP carrega a identidade visual do cadastro de unidades da Central Administrativa:

- `hotel_branding.custom_css_json.horizontal_logo_url`: login e lateral expandida;
- `hotel_branding.icon_url`: lateral recolhida;
- `hotel_branding.font_family`: tipografia;
- `hotels.name`: titulo da pagina e nome da unidade;
- `hotel_branding.primary_color`: cor primaria dos controles e destaques.

O HTML compartilhado nao contem uma identidade fixa do Muller. Ao trocar o `hotel_id`, o mesmo ERP aplica os dados e o branding da unidade autorizada.

## Usuarios do ERP

`erp_users`, `erp_user_permissions` e `erp_sessions` formam um dominio de autenticacao separado de `admin_users` e `admin_sessions`.

- cada usuario operacional pertence a exatamente um `hotel_id`;
- `user_code` e numerico, sequencial dentro da unidade e unico em conjunto com `hotel_id`;
- senhas sao armazenadas somente como hash PBKDF2-SHA-256;
- sessoes usam cookie HttpOnly, expiracao e hash do token no banco;
- alterar a senha ou desativar o usuario revoga sessoes ativas;
- o usuario nao pode consultar nem operar outro hotel por alterar URL ou payload;
- alteracoes de usuarios e de pedidos registram o ator administrativo ou operacional na auditoria.

As permissoes operacionais atuais sao `room-service.dashboard.read`, `room-service.orders.read`, `room-service.orders.write`, `room-service.guests.read`, `room-service.billing.read`, `room-service.catalog.read` e `room-service.users.manage`.

O administrador dev permanece em `admin_users` e recebe `erp.master`. Essa permissao concede acesso a todos os ERPs e nao e atribuida automaticamente aos demais usuarios da Central.

## Banco local

A migration idempotente `0011a_admin_module_bootstrap.sql` corrige o bootstrap de bancos vazios sem alterar migrations antigas. A migration `0014_erp_hotel_users.sql` cria o dominio de usuarios do ERP e os campos de ator operacional. Em um banco local novo:

```powershell
npm run db:migrate:local
npm run db:seed:local
```

O seed local concede `erp.master` apenas ao administrador ficticio de desenvolvimento. Novos usuarios operacionais devem ser criados pela tela de Configuracoes do ERP; senhas nao ficam no repositorio.

## Principios

- Um ERP para todos os hoteis.
- Diferencas por `hotel_id`, permissoes, branding e configuracoes.
- Sem HTML duplicado por hotel.
- Sem Apps Script, Google Sheets, CDN externa ou webhook legado.
- Sem impressao nesta fase.
- Sem dados pessoais em `localStorage`.
- SVGs e componentes visuais locais, sem dependencia do Apps Script legado.
- Acoes de impressao e exportacao permanecem visiveis apenas como referencia do fluxo e ficam desabilitadas em desenvolvimento.

## Central Administrativa

A Central Administrativa deixa de exibir Pedidos como area operacional. Pedidos pertencem ao ERP Room Service.
