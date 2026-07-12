# Usuarios, perfis e permissoes administrativas

Este documento descreve a fundacao de usuarios da Central Administrativa do Ecossistema Fioreze.

## Objetivo

A Central Administrativa passa a ter APIs e telas iniciais para:

- listar usuarios;
- criar usuarios sem senha real versionada;
- editar dados, perfis e unidades;
- ativar e desativar usuarios;
- redefinir senha temporaria;
- encerrar sessoes;
- listar perfis;
- listar permissoes com rotulos humanos.

Nenhuma exclusao fisica de usuario e permitida pelo MVP.

## Rotas visuais

- `/admin/usuarios/`
- `/admin/usuarios/:id/`
- `/admin/perfis/`
- `/admin/minha-conta/`

Essas rotas usam o shell administrativo unico. Nao existe uma aplicacao administrativa separada por hotel.

## APIs

- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users`
- `GET /api/v1/admin/users/:id`
- `PATCH /api/v1/admin/users/:id`
- `POST /api/v1/admin/users/:id/disable`
- `POST /api/v1/admin/users/:id/activate`
- `POST /api/v1/admin/users/:id/password-reset`
- `POST /api/v1/admin/users/:id/sessions/revoke`
- `GET /api/v1/admin/roles`
- `POST /api/v1/admin/roles`
- `GET /api/v1/admin/roles/:id`
- `PATCH /api/v1/admin/roles/:id`
- `PATCH /api/v1/admin/roles/:id/permissions`
- `GET /api/v1/admin/permissions`
- `GET /api/v1/admin/me`
- `POST /api/v1/admin/me/password`
- `POST /api/v1/admin/me/sessions/revoke`

Todas as mutacoes exigem sessao, permissao adequada, `x-fioreze-admin-action: erp-admin` e origem administrativa valida.

## Permissoes

Novas permissoes da migration `0012_admin_users_security.sql`:

| Chave | Rotulo humano |
| --- | --- |
| `admin.users.read` | Ver usuarios |
| `admin.users.create` | Criar usuarios |
| `admin.users.update` | Editar usuarios |
| `admin.users.disable` | Ativar ou desativar usuarios |
| `admin.users.password_reset` | Redefinir senhas |
| `admin.users.sessions_revoke` | Encerrar sessoes |
| `admin.roles.read` | Ver perfis |
| `admin.roles.create` | Criar perfis |
| `admin.roles.update` | Editar perfis |
| `admin.roles.permissions` | Alterar permissoes |
| `admin.audit.read` | Ver auditoria |

A migration nao associa essas permissoes a roles reais. O seed local associa ao `role-demo-manager` apenas para desenvolvimento ficticio.

## Protecoes

- nao retorna `password_hash`, `token_hash`, IP ou user-agent bruto;
- nao permite auto-desativacao;
- bloqueia remocao do ultimo administrador efetivo;
- bloqueia unidade fora do acesso do administrador;
- valida e-mail duplicado;
- registra auditoria sem senha, hash ou token;
- revoga sessoes em reset de senha e troca da propria senha.

## Limitacoes do MVP

- a UI inicial prioriza listagem e acesso as acoes principais;
- a matriz visual completa de permissoes pode ser refinada na fase de polimento;
- roles de sistema ainda nao possuem flag especifica de imutabilidade;
- a aplicacao remota precisa aplicar a migration antes de publicar o Worker com essas rotas.
