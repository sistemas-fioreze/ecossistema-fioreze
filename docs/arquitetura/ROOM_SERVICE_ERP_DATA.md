# Dados do ERP Room Service

## Fontes Atuais

O PR 1 reutiliza as APIs administrativas existentes:

- `GET /api/v1/admin/session`
- `GET /api/v1/admin/orders`
- `GET /api/v1/admin/orders/:id`

## Entidades

- `hotels`: unidades autorizadas ao usuario.
- `orders`: pedidos por `hotel_id` e `module_key`.
- `order_items`: itens dos pedidos.
- `order_status_history`: historico de status.
- `print_events`: historico futuro de impressao, sem acionamento nesta fase.

## Regras

- O navegador pode escolher a unidade, mas o servidor valida novamente o acesso.
- Preferencia local de unidade armazena apenas `hotel_id`.
- Pedidos, hospedes, telefone, observacoes e itens nao sao salvos em storage local.
- Consultas operacionais futuras devem ter paginacao, limites e filtros por `hotel_id`.

## Lacunas para PR 2

- Endpoint de contexto do ERP.
- Dashboard agregado por intervalo e timezone.
- PDV administrativo.
- Catalogo editavel.
- Faturamento com exportacao.
- Status operacional da loja por unidade.
