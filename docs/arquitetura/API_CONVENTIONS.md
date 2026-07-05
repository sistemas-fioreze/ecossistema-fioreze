# Convencoes De API

Todas as rotas novas usam o prefixo `/api/v1/`.

## Resposta

Sucesso:

```json
{
  "ok": true,
  "api_version": "v1",
  "data": {}
}
```

Erro:

```json
{
  "ok": false,
  "api_version": "v1",
  "error": {
    "code": "not_found",
    "message": "Mensagem controlada"
  }
}
```

## Rotas Implementadas

- `GET /api/v1/health`
- `GET /api/v1/public/hotels/:hotel_slug/bootstrap`
- `GET /api/v1/public/hotels/:hotel_slug/modules`
- `GET /api/v1/public/hotels/:hotel_slug/room-service/products`
- `POST /api/v1/public/hotels/:hotel_slug/room-service/orders`
- `/api/v1/admin/*` protegido por autenticacao

## Rotas Contratuais Futuras

- `GET /api/v1/public/hotels/:hotel_slug/emporio/items`
- `POST /api/v1/public/hotels/:hotel_slug/emporio/orders`
- `GET /api/v1/public/hotels/:hotel_slug/spa/services`
- `POST /api/v1/public/hotels/:hotel_slug/spa/requests`
- `GET /api/v1/public/hotels/:hotel_slug/portal/pages`
- `GET /api/v1/public/hotels/:hotel_slug/portal/events`
- `GET /api/v1/public/hotels/:hotel_slug/romantic-packages/packages`
- `POST /api/v1/public/hotels/:hotel_slug/romantic-packages/requests`

Nesta fase, rotas futuras validam hotel e modulo, mas retornam `not_implemented` quando o modulo estiver habilitado e ainda nao tiver fluxo funcional.

## Regras

- Toda consulta filtra por `hotel_id` quando aplicavel.
- Toda query usa parametros.
- Rotas publicas retornam apenas dados publicos.
- Rotas administrativas exigem autenticacao.
- Totais enviados pelo navegador nunca sao confiaveis.
- Modulos desabilitados nao respondem como fluxo normal.
