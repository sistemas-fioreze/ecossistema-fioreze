# ERP Room Service

O ERP Room Service oficial e uma aplicacao unica e reutilizavel para todas as unidades Fioreze.

## Rota

- Canonica: `/erp/room-service/`
- Compatibilidade temporaria: `/admin/room-service/*` redireciona com `308` para `/erp/room-service/*`

O ERP nao usa o shell visual da Central Administrativa. A sessao continua sendo a sessao administrativa central.

## Estrutura

- HTML: `app/public/erp/room-service/index.html`
- CSS: `app/public/css/modules/room-service-erp/`
- JS: `app/public/js/modules/room-service-erp/`

## Modulos Visuais

- Dashboard
- PDV Direto
- Pedidos
- Hospedes
- Faturamento
- Editor de Cardapio
- Configuracoes

No PR 1, apenas a fundacao e o shell estao completos. Os fluxos profundos entram no PR da plataforma operacional.

## Principios

- Um ERP para todos os hoteis.
- Diferencas por `hotel_id`, permissoes, branding e configuracoes.
- Sem HTML duplicado por hotel.
- Sem Apps Script, Google Sheets, CDN externa ou webhook legado.
- Sem impressao nesta fase.
- Sem dados pessoais em `localStorage`.

## Central Administrativa

A Central Administrativa deixa de exibir Pedidos como area operacional. Pedidos pertencem ao ERP Room Service.
