# Estrategia De Autenticacao

O ERP e unico e protegido por sessao administrativa. O MVP local ja implementa login, logout e protecao das APIs administrativas de pedidos.

## Objetivo

- autenticar usuarios administrativos;
- limitar hoteis por `admin_hotel_access`;
- limitar funcionalidades por roles e permissions;
- registrar auditoria administrativa;
- armazenar apenas hashes seguros.

## Senhas

Senhas nunca devem ser salvas em texto puro. O MVP usa WebCrypto com PBKDF2-SHA-256, salt por hash e iteracoes registradas no formato serializado:

```text
pbkdf2$sha256$<iteracoes>$<salt-base64>$<hash-base64>
```

Antes de producao, os parametros de iteracao devem ser revisados e pode ser adotada alternativa mais forte se for compativel com o runtime.

O seed local cria apenas usuario ficticio:

```text
E-mail: admin-demo@example.invalid
Senha: DemoAdmin!2026
```

Essa credencial e apenas de desenvolvimento local e nao representa usuario real.

## Sessoes

As sessoes administrativas seguem estas regras:

- gerar token com `crypto.getRandomValues` ou `crypto.randomUUID` quando apropriado;
- armazenar somente `token_hash`;
- enviar cookie `HttpOnly`, `SameSite=Lax` e `Secure` quando a requisicao usa HTTPS;
- expirar e revogar sessoes;
- validar hotel e modulo em toda rota administrativa.

O nome do cookie e:

```text
fioreze_admin_session
```

Tokens nao sao expostos em query string nem gravados em texto puro no banco.

## Autorizacao

O MVP usa:

- `admin_hotel_access` para limitar hoteis visiveis;
- `admin_roles`;
- `admin_permissions`;
- `admin_user_roles`;
- `admin_role_permissions`.

Permissoes iniciais:

- `room-service.orders.read`;
- `room-service.orders.write`.

Usuarios sem associacao ao hotel nao conseguem listar nem abrir pedidos por manipulacao de URL ou ID.

## Auditoria

Mudancas de status gravam:

- `order_status_history`;
- `admin_audit_log`;
- usuario responsavel;
- data e hora;
- status anterior e novo status em `metadata_json`.

Repetir a mesma transicao ja aplicada e tratado como idempotente e nao duplica eventos.

## Estado Atual

Rotas administrativas implementadas:

- `POST /api/v1/admin/login`;
- `POST /api/v1/admin/logout`;
- `GET /api/v1/admin/session`;
- `GET /api/v1/admin/hotels`;
- `GET /api/v1/admin/orders`;
- `GET /api/v1/admin/orders/:id`;
- `POST /api/v1/admin/orders/:id/status`.

Sem sessao valida, as rotas protegidas retornam `401`.
