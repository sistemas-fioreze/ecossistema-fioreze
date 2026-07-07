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

O login valida que `admin_users.password_strategy` e compativel com o formato do hash armazenado. Quando `force_password_change = 1`, o MVP nao cria sessao administrativa normal e retorna uma mensagem segura indicando que a senha precisa ser redefinida. A tela de troca de senha ainda e uma limitacao conhecida do MVP.

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
- aceitar `x-fioreze-test-now` somente em `ENVIRONMENT=test`;
- validar hotel e modulo em toda rota administrativa.

O nome do cookie e:

```text
fioreze_admin_session
```

Tokens nao sao expostos em query string nem gravados em texto puro no banco.

POSTs administrativos autenticados, como logout e mudanca de status, exigem:

- `Origin` same-origin quando o cabecalho estiver presente;
- cabecalho `x-fioreze-admin-action: erp-admin`;
- cookie de sessao valido para rotas protegidas.

O front-end envia esse cabecalho nas mutacoes administrativas e nao armazena tokens em `localStorage`.

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

Detalhe e mudanca de status filtram diretamente por `hotel_id` permitido pela sessao. Assim, pedido inexistente e pedido de outro hotel retornam `404`, sem revelar que o identificador existe em outro tenant.

## Auditoria

Mudancas de status gravam:

- `order_status_history`;
- `admin_audit_log`;
- usuario responsavel;
- data e hora;
- status anterior e novo status em `metadata_json`.

Repetir a mesma transicao ja aplicada e tratado como idempotente e nao duplica eventos.

A migration `0007_admin_orders_guards.sql` adiciona unicidade em `order_status_history(order_id, status)`. Antes de aplica-la futuramente, executar:

```sql
SELECT order_id, status, COUNT(*) AS total
FROM order_status_history
GROUP BY order_id, status
HAVING COUNT(*) > 1;
```

O fluxo de status usa `UPDATE` otimista, historico e auditoria no mesmo batch. Historico e auditoria sao gravados por `INSERT ... SELECT` condicionado ao pedido estar no status alvo, no hotel/modulo correto e com `updated_at` igual ao horario daquela requisicao. A rota confere `meta.changes` do `UPDATE`: quando zero linhas sao alteradas, os inserts condicionais devem permanecer em zero e o pedido e relido.

Em corrida concorrente para o mesmo status, a requisicao perdedora retorna `idempotent=true` quando o status alvo ja foi aplicado. Em corrida concorrente para destinos diferentes, a perdedora recebe `409 conflict` com o status atual e nao grava historico nem auditoria. Nenhuma mudanca de status cria `print_events` enquanto impressao estiver desativada.

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
