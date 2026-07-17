# Seguranca Do Login Administrativo

O login da Central Administrativa combina sessao server-side, limitacao progressiva de tentativas e, quando ativado de forma controlada, Cloudflare Turnstile. A implementacao e compartilhada pelo Cloudflare Worker e pelo `_worker.js` do Cloudflare Pages.

## Fluxo

1. O backend normaliza o e-mail e calcula identificadores HMAC da conta e do IP.
2. Bloqueios ativos sao consultados antes de qualquer chamada ao Turnstile.
3. Quando `TURNSTILE_ENABLED=true`, o token e validado no Siteverify com action `admin_login` e hostname permitido.
4. A senha sempre passa por PBKDF2, inclusive para contas inexistentes por meio de um hash ficticio, reduzindo diferencas de tempo.
5. Falhas do desafio atualizam somente o contador do IP. Depois de um Turnstile valido, ou quando ele esta desativado, falhas de credenciais atualizam os contadores da conta e do IP.
6. O estado de falhas da conta e removido depois da criacao valida da sessao. O estado do IP permanece independente.

As respostas para usuario inexistente, senha incorreta e desafio invalido nao revelam qual verificacao falhou. Respostas administrativas usam `Cache-Control: no-store`.

## Turnstile

Variaveis publicas:

- `TURNSTILE_ENABLED=false` por padrao;
- `TURNSTILE_SITE_KEY` com a chave publica do widget;
- `TURNSTILE_ALLOWED_HOSTNAMES` com hostnames separados por virgula.

Secret apenas no ambiente Cloudflare:

- `TURNSTILE_SECRET_KEY`.

O endpoint `GET /api/v1/public/admin/login-config` retorna somente a flag e a chave publica. A secret nunca e enviada ao navegador. Quando a flag esta ativa, falha de rede, timeout, configuracao incompleta, action incorreta ou hostname nao autorizado impedem o login.

## Limitacao De Tentativas

A migration `0019_admin_login_security.sql` cria:

- `admin_login_attempts`, sem IP ou e-mail em texto aberto;
- `admin_login_security_events`, com identificadores HMAC e codigos de evento sem credenciais.

A secret `LOGIN_RATE_LIMIT_KEY` deve ter no minimo 32 caracteres e existir apenas como secret no Worker e no Pages. Ela nao pode ser reutilizada como senha de usuario nem versionada.

Politica inicial:

- conta: 5 falhas em 15 minutos;
- IP: 10 falhas em 15 minutos;
- desafios ausentes ou invalidos nunca aumentam o contador da conta;
- bloqueios progressivos de 1, 5, 15 e 60 minutos;
- resposta `429` com `Retry-After` durante o bloqueio;
- limpeza de tentativas expiradas e eventos antigos durante o fluxo seguro de login.

Os contadores usam `INSERT ... ON CONFLICT DO UPDATE` no D1. A criacao da sessao usa `INSERT ... SELECT` condicionado a ausencia de bloqueio ativo, protegendo tambem a janela entre a verificacao da senha e a gravacao da sessao.

## Ativacao Futura

Antes de publicar esta mudanca em qualquer ambiente:

1. revisar e aplicar somente a migration `0019` em rollout autorizado;
2. cadastrar `LOGIN_RATE_LIMIT_KEY` como secret no Worker e no Pages;
3. cadastrar `TURNSTILE_SECRET_KEY` como secret nos dois runtimes;
4. configurar a site key publica e os hostnames corretos;
5. manter `TURNSTILE_ENABLED=false` durante o primeiro deploy;
6. validar login e rate limit;
7. ativar Turnstile em uma etapa separada e monitorada.

Nenhuma migration, secret ou ativacao remota e executada pela inclusao deste codigo.
