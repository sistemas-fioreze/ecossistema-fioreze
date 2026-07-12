# Dados do ERP Room Service

## Fontes Atuais

O PR 1 reutilizou as APIs administrativas existentes. O PR 2 cria uma camada propria do ERP em `/api/v1/admin/room-service/*`, ainda reaproveitando os mesmos servicos e tabelas:

- `GET /api/v1/admin/session`
- `GET /api/v1/admin/room-service/context`
- `GET /api/v1/admin/room-service/dashboard`
- `GET /api/v1/admin/room-service/orders`
- `POST /api/v1/admin/room-service/orders`
- `GET /api/v1/admin/room-service/orders/:id`
- `POST /api/v1/admin/room-service/orders/:id/status`
- `GET /api/v1/admin/room-service/guests`
- `GET /api/v1/admin/room-service/billing`
- `GET /api/v1/admin/room-service/catalog`

## Entidades

- `hotels`: unidades autorizadas ao usuario.
- `orders`: pedidos por `hotel_id` e `module_key`.
- `order_items`: itens dos pedidos.
- `order_status_history`: historico de status.
- `print_events`: historico futuro de impressao, sem acionamento nesta fase.
- `rooms`: acomodacoes ativas da unidade para o PDV.
- `catalogs`, `categories`, `catalog_items`, `catalog_item_availability`: catalogo lido pelo Editor e pelo PDV.
- `hotel_branding`: cores e identidade visual aplicadas ao shell.

## Regras

- O navegador pode escolher a unidade, mas o servidor valida novamente o acesso.
- Preferencia local de unidade armazena apenas `hotel_id`.
- Pedidos, hospedes, telefone, observacoes e itens nao sao salvos em storage local.
- Consultas operacionais devem ter limites e filtros por `hotel_id`.
- O PDV administrativo cria pedidos em `orders` com origem `admin_pdv`.
- O PDV reutiliza o mesmo recalculo de total do Room Service publico.
- Mutacoes administrativas exigem `x-fioreze-admin-action`.

## Lacunas Futuras

- Dashboard agregado por intervalo e timezone.
- Catalogo editavel completo.
- Faturamento com exportacao.
- Status operacional da loja por unidade.
- Permissoes granulares para PDV, faturamento e catalogo.
