# Senhas e sessoes administrativas

Este documento registra a estrategia de senha e sessao da Central Administrativa.

## Hash de senha

O sistema usa PBKDF2-SHA-256 no formato:

`pbkdf2$sha256$<iterations>$<salt-base64>$<hash-base64>`

O valor completo nunca deve aparecer em logs, documentacao, respostas da API ou fixtures reais.

## Politica de senha

- minimo de 12 caracteres;
- maximo de 300 caracteres;
- prioriza comprimento;
- impede senha igual a atual;
- impede senha baseada apenas no e-mail ou no primeiro nome;
- nao exige simbolos arbitrarios.

## Login com troca obrigatoria

Quando `force_password_change=1`, o login valido cria uma sessao restrita com:

`session_type=password_change_required`

Essa sessao pode acessar apenas:

- consulta basica da propria conta;
- troca obrigatoria da senha;
- logout.

As demais APIs administrativas retornam erro de acesso ate a senha ser alterada.

Depois da troca:

- `force_password_change` volta para `0`;
- `password_changed_at` e preenchido;
- todas as sessoes do usuario sao revogadas;
- o cookie atual e limpo;
- o usuario precisa entrar novamente.

## Reset administrativo

O reset administrativo:

- gera senha temporaria com `crypto.getRandomValues`;
- mostra a senha somente na resposta imediata;
- salva apenas o hash;
- marca troca obrigatoria;
- revoga sessoes do usuario;
- audita o evento sem senha, hash ou token.

## Sessoes

As sessoes ficam em `admin_sessions` e guardam:

- hash do token;
- hash opcional de user-agent;
- hash opcional de IP;
- tipo da sessao;
- criacao;
- expiracao;
- revogacao.

O token em texto claro existe somente no cookie HttpOnly enviado ao navegador.

## Cookies

O cookie administrativo usa:

- `HttpOnly`;
- `SameSite=Lax`;
- `Secure` quando publicado em HTTPS fora do ambiente de teste;
- expiracao de oito horas.

## Auditoria

Eventos registrados:

- `admin-user.password-reset`;
- `admin-user.password-change`;
- `admin-user.sessions-revoked`.

Metadados nao podem conter:

- senha;
- hash;
- token;
- cookie;
- IP bruto;
- user-agent bruto.

## Rollout futuro

Antes de publicar esta fase em desenvolvimento remoto:

1. criar bookmark Time Travel;
2. aplicar apenas a migration `0012_admin_users_security.sql`;
3. validar `admin_sessions.session_type` e `admin_users.password_changed_at`;
4. associar permissoes a roles de desenvolvimento de forma controlada;
5. fazer deploy do Worker;
6. testar login, sessao restrita e troca de senha sem usar dados reais.
