# Arquitetura Da Plataforma

A plataforma e um Worker unico com Static Assets e D1. Ela separa um core compartilhado de modulos independentes.

## Core

O core fica em `app/src/core/` e responde por:

- roteamento HTTP;
- tenant por `hotel_slug`;
- bootstrap publico;
- acesso parametrizado ao D1;
- respostas JSON padronizadas;
- validacao;
- erros controlados;
- modulos registrados;
- feature flags;
- identidade visual;
- navegacao publica;
- horarios operacionais publicos por hotel e modulo.

Middlewares em `app/src/middleware/` cuidam de autenticacao, autorizacao, tenant, modulo habilitado e seguranca HTTP.

## Modulos

Modulos ficam em `app/src/modules/`. Nesta fase:

- `room-service`: base funcional com produtos ficticios e criacao local de pedidos.
- `guest-portal`: contrato e tabelas iniciais.
- `emporio`: contrato de rota futura.
- `spa`: contrato e tabelas iniciais.
- `romantic-packages`: contrato e tabelas iniciais.
- `admin`: ERP unico protegido, ainda sem login definitivo.

## Front-end

Existe um shell publico unico em `app/public/index.html`. Ele:

- identifica o hotel pelo slug da URL;
- consulta o bootstrap publico;
- aplica branding;
- monta navegacao com modulos habilitados;
- carrega o modulo solicitado;
- mostra erro amigavel se a API local falhar;
- nao baixa HTML remoto.

O ERP tambem e unico em `app/public/admin/index.html`.

## Banco

O D1 e local nesta fase. Migrations D1 executaveis ficam versionadas diretamente em `app/migrations/`, em ordem definida pelo prefixo numerico global. Modulos continuam separados no codigo e na documentacao, mas nao por subpastas de migrations executaveis. Seeds ficam em `app/seeds/dev.sql` e contem apenas dados ficticios.

`service_hours` e a fonte canonica de horarios operacionais, separada por `hotel_id` e `module_key`, com suporte a varias faixas no mesmo dia por `sort_order`. O timezone vem de `hotels.timezone`, evitando duplicacao em cada linha de horario.

`media_assets` guarda metadados de assets e midias, nunca binarios. Nesta fase os registros de demonstracao usam `storage_provider = static`; R2 permanece apenas como arquitetura futura.

A migration `0007_core_service_hours_media_assets.sql` e incremental porque `0001` a `0006` ja foram aplicadas no D1 remoto de desenvolvimento.

## Seguranca De Escopo

Nao ha acesso a producao, Apps Script, Google Sheets, servidor de impressao, impressora, Cloudflare remoto ou D1 remoto. O arquivo `wrangler.jsonc` guarda configuracao de desenvolvimento, mas isso nao autoriza comandos remotos.
