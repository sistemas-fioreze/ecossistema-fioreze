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
- navegacao publica.

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

O D1 e local nesta fase. Migrations ficam versionadas em `app/migrations/`, separadas entre `core` e `modules`. Seeds ficam em `app/seeds/dev.sql` e contem apenas dados ficticios.

## Seguranca De Escopo

Nao ha acesso a producao, Apps Script, Google Sheets, servidor de impressao, impressora, Cloudflare remoto ou D1 remoto. O arquivo `wrangler.jsonc` guarda configuracao de desenvolvimento, mas isso nao autoriza comandos remotos.
