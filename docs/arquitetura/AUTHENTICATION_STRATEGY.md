# Estrategia De Autenticacao

O ERP sera unico e protegido. Login definitivo ainda nao foi implementado nesta fase.

## Objetivo

- autenticar usuarios administrativos;
- limitar hoteis por `admin_hotel_access`;
- limitar funcionalidades por roles e permissions;
- registrar auditoria administrativa;
- armazenar apenas hashes seguros.

## Senhas

Senhas nunca devem ser salvas em texto puro. A estrategia futura deve usar WebCrypto no Worker com algoritmo adequado e parametros documentados, como PBKDF2 com salt unico e numero de iteracoes revisado antes de producao. Alternativas mais fortes podem ser adotadas se forem compativeis com o runtime e validadas.

Seeds locais usam placeholder desabilitado, sem senha real.

## Sessoes

Quando login for implementado:

- gerar token com `crypto.getRandomValues` ou `crypto.randomUUID` quando apropriado;
- armazenar somente `token_hash`;
- enviar cookie `HttpOnly`, `Secure` e `SameSite`;
- expirar e revogar sessoes;
- validar hotel e modulo em toda rota administrativa.

## Estado Atual

Todas as rotas em `/api/v1/admin/*` retornam `401` sem autenticacao. Isso e intencional.
