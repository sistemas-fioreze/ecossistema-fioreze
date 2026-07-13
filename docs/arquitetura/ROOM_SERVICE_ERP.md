# ERP Room Service

O ERP Room Service oficial e uma aplicacao unica e reutilizavel para todas as unidades Fioreze.

## Rota

- Canonica: `/erp/room-service/`
- Compatibilidade temporaria: `/admin/room-service/*` redireciona com `308` para `/erp/room-service/*`

O ERP nao usa o shell visual da Central Administrativa. A sessao continua sendo a sessao administrativa central.

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

- `GET /api/v1/admin/room-service/context`
- `GET /api/v1/admin/room-service/dashboard`
- `GET /api/v1/admin/room-service/orders`
- `POST /api/v1/admin/room-service/orders`
- `GET /api/v1/admin/room-service/orders/:id`
- `POST /api/v1/admin/room-service/orders/:id/status`
- `GET /api/v1/admin/room-service/guests`
- `GET /api/v1/admin/room-service/billing`
- `GET /api/v1/admin/room-service/catalog`

As rotas usam a sessao administrativa, validam acesso por unidade e mantem a impressao desativada.

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
