# Estrutura Do Repositorio

Este repositorio guarda o ecossistema digital da Familia Fioreze em tres areas principais.

## `app/`

Contem a plataforma nova. O codigo e compartilhado entre hoteis e modulos:

- Worker em `src/`;
- shell publico unico em `public/index.html`;
- ERP unico em `public/admin/index.html`;
- CSS e JavaScript separados entre `core` e `modules`;
- migrations versionadas em `migrations/`;
- seeds ficticios em `seeds/`;
- testes locais em `tests/`;
- scripts de validacao local em `scripts/`.

Nao devem existir aplicacoes como `app/muller/`, `app/hotel-2/` ou `app/<hotel_id>/`.

## `legacy/`

Contem copias sanitizadas dos sistemas antigos. A estrutura esperada e:

```text
legacy/hoteis/<hotel_id>/
  room-service/
  portal-hospede/
  emporio/
  spa/
  impressao/
```

Essa area e somente referencia. O codigo legado nao deve ser alterado durante o desenvolvimento da plataforma nova.

## `docs/`

Contem inventarios, mapas, regras, plano de migracao e contratos de arquitetura. Novas decisoes tecnicas devem ser registradas em `docs/arquitetura/`.

## Como Adicionar Um Hotel

1. Criar um `hotel_id` em minusculas, sem espacos e sem acentos.
2. Criar linhas em `hotels`, `hotel_branding`, `hotel_settings`, `hotel_modules`, `navigation_items` e, quando aplicavel, `rooms`.
3. Habilitar somente os modulos permitidos para esse hotel.
4. Adicionar assets publicos em `app/public/assets/hotels/<hotel_id>/` quando forem sanitizados e permitidos.
5. Criar testes de isolamento para garantir que o novo hotel nao ve dados de outros hoteis.

## Como Adicionar Um Modulo

1. Registrar o `module_key` na tabela `modules`.
2. Criar pasta em `app/src/modules/<module_key>/`.
3. Criar assets de front-end em `app/public/js/modules/<module_key>/` e `app/public/css/modules/<module_key>/`.
4. Criar migrations especificas quando o fluxo do modulo exigir tabelas proprias.
5. Registrar rotas no core somente por contrato de modulo.
6. Validar `hotel_modules.enabled` em toda rota publica e administrativa do modulo.

## Compartilhado E Especifico

Compartilhado: roteamento, tenant, respostas HTTP, validacao, acesso ao D1, autenticacao, autorizacao, auditoria, bootstrap, feature flags, branding e navegacao.

Especifico por modulo: regras de negocio, tabelas proprias, componentes visuais e rotas do modulo.

Nunca duplicar: Worker, shell publico, ERP, conexao D1, login, autorizacao, bootstrap ou aplicacoes por hotel.

## Convencoes

- `hotel_id`: minusculas, hifens, sem acentos. Exemplo: `muller-fioreze`.
- `module_key`: minusculas, hifens, em ingles. Exemplo: `room-service`.
- rotas publicas: `/<hotel_slug>/<module_key>` e `/api/v1/public/hotels/:hotel_slug/...`.
- rotas administrativas: `/admin` e `/api/v1/admin/...`.
- dados de hotel ficam no D1; codigo compartilhado nao deve fixar nomes, horarios, cores ou regras de um hotel.
