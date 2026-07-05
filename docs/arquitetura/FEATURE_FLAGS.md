# Feature Flags

Feature flags permitem evoluir a plataforma sem duplicar codigo por hotel.

## Tabelas

- `features`: define a flag, modulo associado, status e visibilidade publica.
- `hotel_features`: habilita ou desabilita a flag por hotel.

## Regras

- Flags publicas podem aparecer no bootstrap.
- Flags internas nunca devem ser retornadas ao front-end publico.
- Uma flag nao substitui permissao de modulo. `hotel_modules.enabled` continua obrigatorio.
- Rotas administrativas devem validar permissao, nao apenas flag.

## Exemplos Locais

- `room-service.order-notes`: flag publica de observacoes no pedido.
- `portal.events-preview`: flag publica de eventos no portal.
- flags internas de ERP devem ficar fora do bootstrap.
