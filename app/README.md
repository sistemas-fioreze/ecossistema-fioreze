# Plataforma Fioreze App

Aplicacao nova e compartilhada do ecossistema digital da Familia Fioreze.

## Visao

Um unico Worker, um unico front-end publico, uma unica autenticacao administrativa e um unico banco D1 multi-hotel. O Muller e Fioreze e o primeiro tenant e Room Service e o primeiro modulo funcional, mas a base suporta Portal do Hospede, Emporio, Spa, Pacotes Romanticos, Central de Portais e modulos futuros.

## Arquitetura

- `public/index.html`: shell publico unico.
- `public/admin/index.html`: central de acesso administrativo.
- `public/admin/room-service/index.html`: ERP operacional do Room Service.
- `public/admin/portais/index.html`: fundacao visual da Central de Portais Fioreze.
- `src/core/`: roteamento, D1, tenant, bootstrap, validacao, respostas e feature flags.
- `src/middleware/`: autenticacao, autorizacao, modulo habilitado e headers.
- `src/modules/`: regras e rotas por modulo.
- `migrations/`: SQL versionado em diretorio plano, com ordem pelo prefixo numerico global.
- `seeds/dev.sql`: dados ficticios locais.
- `tests/`: testes locais com D1 mockado.
- `scripts/`: validacoes locais e utilitarios.

## Front-end

O shell publico identifica o hotel pelo slug da URL, chama `/api/v1/public/hotels/:hotel_slug/bootstrap`, aplica branding, monta a navegacao e carrega o modulo. Ele nao baixa HTML remoto.

As telas administrativas compartilham o mesmo Worker e D1, mas usam dominios de autenticacao separados:

- ERP Room Service: usuarios operacionais por `hotel_id`, cookie `fioreze_erp_session` e permissoes dos modulos do ERP;
- Central de Portais Fioreze: usuarios globais em `admin_users`, cookie `fioreze_admin_session` e permissoes administrativas.

O administrador ficticio de desenvolvimento recebe `erp.master` e pode acessar todos os ERPs. Outros usuarios da Central nao entram no ERP.

Rotas administrativas:

- `/admin/`: central de acesso administrativo e selecao de sistemas;
- `/admin/mensagens/`: caixa interna para comunicacao entre usuarios administrativos autorizados;
- `/erp/room-service/`: ERP operacional canonico do Room Service;
- `/admin/room-service/`: redirecionamento de compatibilidade para o ERP;
- `/admin/portais/`: Central de Portais Fioreze.

Autorizacao visual usa `permission_key` retornada pela sessao e acesso por hotel retornado pelo backend. A barreira efetiva permanece nas APIs administrativas.

Rotas publicas compartilhadas:

- `/muller-fioreze`
- `/muller-fioreze/room-service`
- `/muller-fioreze/emporio`
- `/muller-fioreze/spa`
- `/muller-fioreze/romantic-packages`

## Bootstrap

`GET /api/v1/public/hotels/:hotel_slug/bootstrap` retorna somente dados publicos:

- hotel;
- branding;
- modulos habilitados;
- navegacao;
- horarios publicos em `service_hours`;
- configuracoes publicas;
- feature flags publicas;
- status de servicos;
- base publica de assets.

Nao retorna usuarios, permissoes, tokens, segredos ou configuracoes internas.

## Banco

Tabelas principais:

- core: `hotels`, `hotel_domains`, `hotel_branding`, `hotel_settings`, `modules`, `hotel_modules`, `navigation_items`, `features`, `hotel_features`, `rooms`, `service_hours`, `media_assets`;
- admin: `admin_users`, `admin_roles`, `admin_permissions`, `admin_user_roles`, `admin_role_permissions`, `admin_hotel_access`, `admin_sessions`, `admin_audit_log`;
- usuarios operacionais do ERP: `erp_users`, `erp_user_permissions`, `erp_sessions`;
- portal: `portal_pages`, `portal_sections`, `portal_content_items`, `custom_portal_pages`, `visual_portals`, `visual_portal_versions`, `visual_portal_templates`, `events`, `hotel_information`;
- catalogos: `catalogs`, `categories`, `catalog_items`, `catalog_item_availability`;
- pedidos: `orders`, `order_items`, `order_status_history`, `print_events`;
- spa: `spa_services`, `spa_service_requests`, `spa_appointments`;
- pacotes: `romantic_packages`, `romantic_package_requests`.

## Endpoints

Implementados:

- `GET /api/v1/health`
- `GET /api/v1/public/hotels/:hotel_slug/bootstrap`
- `GET /api/v1/public/hotels/:hotel_slug/modules`
- `GET /api/v1/public/hotels/:hotel_slug/portal/home`
- `GET /api/v1/public/hotels/:hotel_slug/portal/pages`
- `GET /api/v1/public/hotels/:hotel_slug/portal/events`
- `GET /api/v1/public/hotels/:hotel_slug/room-service/products`
- `GET /api/v1/public/hotels/:hotel_slug/room-service/rooms`
- `POST /api/v1/public/hotels/:hotel_slug/room-service/orders`
- `POST /api/v1/admin/login`
- `POST /api/v1/admin/logout`
- `GET /api/v1/admin/session`
- `GET /api/v1/admin/room-service/login-context`
- `POST /api/v1/admin/room-service/login`
- `POST /api/v1/admin/room-service/logout`
- `GET /api/v1/admin/room-service/session`
- `GET /api/v1/admin/room-service/users`
- `POST /api/v1/admin/room-service/users`
- `PATCH /api/v1/admin/room-service/users/:id`
- `POST /api/v1/admin/room-service/users/:id/password`
- `GET /api/v1/admin/room-service/operations`
- `POST /api/v1/admin/room-service/operations/mode`
- `PATCH /api/v1/admin/room-service/operations/schedule`
- `GET /api/v1/admin/room-service/rooms`
- `POST /api/v1/admin/room-service/rooms`
- `PATCH /api/v1/admin/room-service/rooms/:id`
- `POST /api/v1/admin/room-service/catalog/categories`
- `PATCH /api/v1/admin/room-service/catalog/categories/:id`
- `POST /api/v1/admin/room-service/catalog/items`
- `PATCH /api/v1/admin/room-service/catalog/items/:id`
- `GET /api/v1/admin/room-service/media`
- `POST /api/v1/admin/room-service/media`
- `POST /api/v1/admin/room-service/me/avatar`
- `DELETE /api/v1/admin/room-service/me/avatar`
- `POST /api/v1/admin/room-service/me/password`
- `GET /api/v1/admin/hotels`
- `GET /api/v1/admin/orders`
- `GET /api/v1/admin/orders/:id`
- `POST /api/v1/admin/orders/:id/status`
- `POST /api/v1/admin/media`
- `GET /api/v1/admin/media`
- `GET /api/v1/admin/media/:id`
- `PATCH /api/v1/admin/media/:id`
- `DELETE /api/v1/admin/media/:id`
- `GET /api/v1/admin/custom-portal-pages`
- `POST /api/v1/admin/custom-portal-pages`
- `GET /api/v1/admin/custom-portal-pages/:id`
- `PATCH /api/v1/admin/custom-portal-pages/:id`
- `DELETE /api/v1/admin/custom-portal-pages/:id`
- `GET /api/v1/admin/visual-portals`
- `POST /api/v1/admin/visual-portals`
- `GET /api/v1/admin/visual-portals/:id`
- `PATCH /api/v1/admin/visual-portals/:id`
- `DELETE /api/v1/admin/visual-portals/:id`
- `POST /api/v1/admin/visual-portals/:id/publish`
- `POST /api/v1/admin/visual-portals/:id/duplicate`
- `GET /api/v1/admin/visual-portals/:id/versions`
- `POST /api/v1/admin/visual-portals/:id/versions/:versionId/restore`
- `GET /api/v1/admin/visual-portal-templates`
- `POST /api/v1/admin/visual-portal-templates`
- `GET /api/v1/admin/visual-portal-templates/:id`
- `DELETE /api/v1/admin/visual-portal-templates/:id`
- `GET /api/v1/admin/short-links/:id/qrcode.svg`
- `DELETE /api/v1/admin/short-links/:id/permanent`
- `GET /api/v1/admin/short-links/:id/shares`
- `POST /api/v1/admin/short-links/:id/shares`
- `DELETE /api/v1/admin/short-links/:id/shares/:userId`
- `GET /api/v1/admin/portal/content`
- `POST /api/v1/admin/portal/pages`
- `GET /api/v1/admin/portal/pages/:id`
- `PATCH /api/v1/admin/portal/pages/:id`
- `POST /api/v1/admin/portal/pages/:id/sections`
- `PATCH /api/v1/admin/portal/sections/:id`
- `POST /api/v1/admin/portal/events`
- `PATCH /api/v1/admin/portal/events/:id`
- `POST /api/v1/admin/portal/information`
- `PATCH /api/v1/admin/portal/information/:id`
- `GET /api/v1/admin/audit`
- `GET /media/:id`
- `HEAD /media/:id`
- `GET /portal-content/:hotel_slug/:page_slug`
- `HEAD /portal-content/:hotel_slug/:page_slug`
- `GET /portal/:hotel_slug/:portal_slug`
- `HEAD /portal/:hotel_slug/:portal_slug`

Contratos futuros:

- Emporio: items e orders;
- Spa: services e requests;
- Pacotes Romanticos: packages e requests.

## Variaveis

`.dev.vars.example` contem:

```text
ENVIRONMENT=development
IMPRESSION_ENABLED=false
DEFAULT_HOTEL_SLUG=muller-fioreze
TURNSTILE_ENABLED=false
TURNSTILE_SITE_KEY=TURNSTILE_SITE_KEY_PUBLICA_AQUI
TURNSTILE_ALLOWED_HOSTNAMES=localhost,127.0.0.1
TURNSTILE_SECRET_KEY=TURNSTILE_SECRET_KEY_LOCAL_NAO_VERSIONADA
LOGIN_RATE_LIMIT_KEY=LOGIN_RATE_LIMIT_KEY_LOCAL_COM_32_CARACTERES_OU_MAIS
```

Nao colocar credenciais reais em `.dev.vars`, `wrangler.jsonc` ou seeds. `TURNSTILE_SECRET_KEY` e `LOGIN_RATE_LIMIT_KEY` devem ser secrets separados no Worker e no Pages; somente placeholders locais aparecem em `.dev.vars.example`.

O `wrangler.jsonc` de desenvolvimento declara o binding R2:

```jsonc
"r2_buckets": [
  {
    "binding": "MEDIA_BUCKET",
    "bucket_name": "fioreze-portais-media-dev"
  }
]
```

Nao usar `remote=true`, `r2.dev`, dominio publico de bucket, bucket de producao ou chaves S3 nesta fase. O acesso publico deve passar pelo Worker em `/media/:id`.

## Comandos Locais

```bash
npm install
npm run validate
npm test
npm run db:migrate:local
npm run db:seed:local
npm run dev
npm run pages:build
npm run pages:check
npm run pages:dev
```

Todos os scripts D1 usam modo local. O script `pages:deploy` publica somente o projeto Pages separado e deve ser usado apenas em uma etapa remota controlada; ele nao executa migration, seed ou deploy do Worker atual.

## Cloudflare Pages Paralelo

`wrangler.jsonc` permanece como a configuracao do Worker `fioreze-portais-dev`. A configuracao independente `pages/wrangler.jsonc` prepara o projeto Pages `fioreze-portais-pages-dev`, com saida em `pages/dist` e Pages Functions no modo avancado `_worker.js`.

O build reutiliza `src/index.js`, copia todos os arquivos de `public/` e preserva os bindings `DB`, `MEDIA_BUCKET` e `ASSETS`. As instrucoes de criacao do projeto, bindings do painel, variaveis e validacao estao em `docs/arquitetura/CLOUDFLARE_PAGES_PARALLEL.md`.

## Migrations E Seeds Locais

As migrations D1 executaveis ficam diretamente em `app/migrations/`. O Wrangler usa `migrations/*.sql`, entao a ordem deve ser definida pelo prefixo numerico global: `0001`, `0002`, `0003` e assim por diante. Modulos nao devem criar sequencias independentes em subpastas.

A migration `0007_core_service_hours_media_assets.sql` e incremental porque `0001` a `0006` ja foram aplicadas no D1 remoto de desenvolvimento. Migrations ja aplicadas nao devem ser editadas; qualquer mudanca posterior de schema deve criar a proxima migration global.

`service_hours` e a fonte canonica de horarios operacionais por hotel e modulo. Ela permite varias faixas por dia usando `sort_order`; o timezone vem de `hotels.timezone`.

`media_assets` guarda metadados de midia e assets. O D1 nao armazena binarios. O seed usa assets `static` sanitizados, e a Biblioteca de Imagens usa R2 para binarios.

A migration `0008_media_library_foundation.sql` prepara a Biblioteca de Imagens:

- metadados adicionais em `media_assets`: nome original sanitizado, tamanho, SHA-256, ETag, usuario de upload e usuario de arquivamento;
- indices por `hotel_id/status/created_at`, checksum e usuario de upload;
- permissoes `portals.media.read`, `portals.media.upload`, `portals.media.update` e `portals.media.archive`;
- nenhuma permissao e atribuida a roles pela migration.

A migration `0017_admin_preferences_media_folders.sql` adiciona:

- preferencias visuais persistidas por usuario administrativo em `admin_user_preferences`;
- pastas e subpastas isoladas por `hotel_id` em `media_folders`;
- a associacao opcional `media_assets.folder_id`, sem alterar a URL publica nem o objeto R2 quando uma imagem e organizada;
- indices para navegacao por pasta e unicidade de nomes entre pastas irmas ativas.

A migration `0020_portal_custom_pages_qr_links.sql` adiciona paginas HTML sanitizadas por unidade e a permissao de exclusao definitiva de links arquivados. O HTML original nunca e persistido; a publicacao usa `iframe` sandbox, CSP restritiva e rota Worker-first em `/portal-content/*`. QR Codes sao gerados localmente como SVG a partir do `public_url` do link, sem servico externo.

A migration `0021_guest_portal_reference_features.sql` associa eventos a imagens da Biblioteca de Midia. A relacao e opcional, isolada por unidade na API e nao altera eventos existentes.

O Portal do Hospede usa um unico shell para todas as unidades. Identidade, localizacao, eventos, modulos e capas de servicos sao resolvidos pelo `hotel_id`; nenhuma imagem ou cor do Muller fica fixa no codigo compartilhado. A capa da unidade aceita imagem ou video da Biblioteca de Midia; no mobile ela aparece somente na guia Inicio e e removida ao trocar de area. O movimento respeita a preferencia de reducao de animacoes do navegador. A previsao publica usa Gramado como localidade padrao para todas as unidades, por meio do Open-Meteo consultado pelo Worker. O blog e consultado pelo Worker no feed oficial permitido e devolvido ao navegador em um formato reduzido e sanitizado. Falhas desses servicos externos nao impedem a abertura do portal.

Na Central Administrativa, a identidade da unidade usa um seletor visual da Biblioteca de Midia. Logos e imagens sociais aceitam imagens; a capa do portal aceita imagem ou video. A area **Conteudos > Eventos** permite escolher uma imagem ativa e, em **Areas**, cada modulo pode receber uma capa propria usada nos botoes publicos de servico. O feed do blog e configurado nos dados gerais da unidade e permanece restrito ao endpoint oficial autorizado.

A migration `0018_admin_messages_and_reference_numbers.sql` adiciona:

- numeros sequenciais de referencia para usuarios e perfis administrativos;
- caixa de mensagens interna entre usuarios administrativos ativos;
- indices para consulta eficiente de mensagens recebidas, enviadas e nao lidas;
- exclusao protegida de perfis, mantendo bloqueados perfis do sistema ou ainda associados a usuarios.

Como `ALTER TABLE ... ADD COLUMN` no D1/SQLite nao e uma forma segura de adicionar foreign keys em colunas novas, `uploaded_by_user_id` e `archived_by_user_id` ficam nullable e a integridade e validada pela aplicacao. Uma migration futura pode reconstruir a tabela se uma FK fisica for necessaria.

Aplicar migrations:

```bash
npm run db:migrate:local
```

Aplicar dados ficticios:

```bash
npm run db:seed:local
```

Reset local exige confirmacao:

```bash
CONFIRM_LOCAL_DB_RESET=yes npm run db:reset:local
```

## Testes

Os testes cobrem:

- saude;
- hotel existente e inexistente;
- bootstrap;
- horarios publicos em `service_hours`;
- branding;
- modulos habilitados e desabilitados;
- produtos;
- pedido valido;
- preco, subtotal e total adulterados;
- produto inexistente, indisponivel, arquivado, de outro hotel e de outro modulo;
- isolamento por hotel;
- rota admin sem autenticacao;
- roteamento administrativo separado para central, Room Service e Portais;
- login, logout, sessao expirada e cookies administrativos;
- listagem e detalhe de pedidos limitados aos hoteis permitidos;
- transicoes de status, idempotencia, concorrencia, historico e auditoria;
- impressao desativada;
- Biblioteca de Midia com R2 mockado localmente;
- validacao de imagens JPEG, PNG, WebP e AVIF e de videos MP4, WebM e MOV por MIME, magic bytes, extensao e tamanho;
- preferencias de paleta separadas por usuario;
- criacao, navegacao, renomeacao, movimentacao e arquivamento de pastas;
- isolamento de pastas e imagens entre unidades e bloqueio de ciclos.

## Biblioteca De Midia

A Central de Portais possui a rota `/admin/portais/media/`. Ela organiza imagens e videos publicos de hoteis e modulos em um gerenciador unificado, usando:

- D1 para metadados em `media_assets`;
- R2 para binarios via binding `MEDIA_BUCKET`;
- rota publica segura `/media/:id`, com bucket privado e sem expor `object_key`;
- `public_url` relativo e estavel no formato `/media/<asset_id>`;
- `object_key` gerado exclusivamente no servidor como `hotels/<hotel_id>/<module_or_shared>/<yyyy>/<mm>/<asset_id>.<ext>`.
- pastas e subpastas administrativas, com navegacao por breadcrumbs;
- visualizacao conjunta de pastas e arquivos em grade ou lista;
- movimentacao de midias e pastas por arrastar e soltar;
- indicador de uso calculado a partir dos objetos registrados no D1 para a unidade.

Formatos aceitos:

- `image/jpeg`;
- `image/png`;
- `image/webp`;
- `image/avif`.
- `video/mp4`;
- `video/webm`;
- `video/quicktime`.

Limite inicial: 8MB por imagem e 25MB por video. SVG e arquivos vazios sao rejeitados. O Worker valida `Content-Type`, extensao, tamanho real e magic bytes, calcula SHA-256 e sanitiza `original_filename`, `alt_text` e `module_key`.

Permissoes administrativas:

- `portals.media.read`: listar e visualizar biblioteca;
- `portals.media.upload`: enviar imagem ou video;
- `portals.media.update`: alterar `alt_text`, `module_key`, organizar arquivos e gerenciar pastas;
- `portals.media.archive`: arquivar logicamente.

Na interface, Excluir move o registro para a lixeira logica. O objeto R2 permanece preservado para recuperacao e a midia passa a retornar 404 em `/media/:id`. Falha de metadados D1 depois de um `put` no R2 aciona compensacao local, removendo o objeto recem-enviado antes de retornar erro seguro.

Mover uma midia entre pastas altera somente `media_assets.folder_id`: `public_url`, `object_key`, checksum e o binario no R2 permanecem intactos. Pastas nao vazias nao podem ser excluidas, e a API impede mover uma pasta para dentro dela mesma ou de uma descendente.

O shell da Central usa uma copia versionada e sanitizada do asset oficial da marca em `/assets/shared/fioreze-central-logo.jpg`. A origem aprovada foi a midia de desenvolvimento `media_7449a1c9-2575-447d-a782-7b206b186985`; a copia local evita dependencia de sessao, registro D1 ou disponibilidade do R2 para renderizar a identidade administrativa. Cada usuario pode escolher uma das paletas no menu da sessao; a preferencia e validada no Worker e salva por `admin_users.id`.

Como Static Assets usa `not_found_handling: single-page-application`, o `wrangler.jsonc` precisa manter `/media/*` em `assets.run_worker_first`, junto de `/api/*` e `/admin/*`. Sem isso, a borda da Cloudflare poderia entregar o fallback HTML antes da rota do Worker. Os testes locais chamam o export do Worker diretamente, entao nao reproduzem completamente a precedencia da borda; por isso tambem existe teste de configuracao para garantir `/media/*` em `run_worker_first`.

Comandos futuros, nao executados nesta implementacao:

```bash
wrangler r2 bucket create fioreze-portais-media-dev
wrangler d1 migrations apply fioreze-portais-db-dev --remote
wrangler deploy
```

Antes de qualquer uso remoto, esses comandos precisam de autorizacao explicita e novo preflight. Um dominio de midia dedicado pode ser adicionado no futuro, mas nao deve substituir a regra de bucket privado sem revisao.

Fora do escopo atual:

- redimensionamento;
- compressao;
- remocao de EXIF;
- variantes responsivas;
- R2 lifecycle;
- delecao fisica por UI.

## Autenticacao

O MVP administrativo implementa login real para ambiente local e desenvolvimento controlado:

- senha armazenada como PBKDF2-SHA-256 serializado em `admin_users.password_hash`;
- hashes administrativos devem usar exatamente 100000 iteracoes PBKDF2, limite aceito pelo runtime do Worker nesta implementacao;
- token de sessao gerado com WebCrypto e armazenado somente como `token_hash`;
- cookie `fioreze_admin_session` com `HttpOnly`, `SameSite=Lax` e `Secure` quando a requisicao usa HTTPS;
- sessoes expiram e podem ser revogadas no logout;
- o cabecalho `x-fioreze-test-now` so e aceito quando `ENVIRONMENT=test`;
- POSTs administrativos autenticados exigem origem same-origin, quando `Origin` existir, e o cabecalho `x-fioreze-admin-action: erp-admin`;
- acesso por hotel vem de `admin_hotel_access`;
- tentativas usam HMAC da conta e do IP, sem armazenar os valores brutos;
- bloqueios progressivos retornam `429` e `Retry-After`;
- Turnstile usa action `admin_login`, validacao server-side e permanece desligado por padrao;
- o shell aguarda `/api/v1/admin/session` e nao guarda usuario, hoteis ou permissoes em `sessionStorage`;
- permissoes usadas pelo MVP:
  - `room-service.orders.read`;
  - `room-service.orders.write`;
- `portals.media.read`;
- `portals.media.upload`;
- `portals.media.update`;
- `portals.media.archive`;
- `portals.embed.read`;
- `portals.embed.update`.

O ERP operacional usa o mesmo algoritmo de hash, mas guarda usuarios e sessoes nas tabelas `erp_users` e `erp_sessions`. Cada codigo numerico e sequencial dentro de um hotel, e cada permissao em `erp_user_permissions` fica associada ao mesmo `hotel_id`. A API nunca consulta um usuario operacional sem filtrar a unidade.

Senhas operacionais aceitam no minimo quatro caracteres, conforme a regra atual do produto. Mesmo nesse limite, o valor nunca e salvo em texto puro: somente o hash PBKDF2-SHA-256 e persistido. A troca pela propria conta revoga as outras sessoes do usuario. Foto de perfil e armazenada no R2 como `media_assets`, ligada somente ao usuario operacional e ao hotel correspondentes.

As permissoes de midia sao cadastradas pela migration `0008`, mas nao sao associadas automaticamente a nenhum role. A liberacao de usuarios no D1 de desenvolvimento deve ser uma etapa operacional separada e autorizada.

O cartao Room Service da central aparece para usuarios com `room-service.orders.read`. A Central de Portais aparece somente para usuarios com permissoes futuras prefixadas por `platform.` ou `portals.`. Nao ha autorizacao por e-mail, nome de usuario ou regra fixa no frontend.

Credenciais ficticias do seed local:

```text
E-mail: admin-demo@example.invalid
Senha: DemoAdmin!2026
```

Essas credenciais sao somente para desenvolvimento local. Nao usar dados reais em seeds, testes ou documentacao.

Quando `admin_users.force_password_change = 1`, o MVP bloqueia o login e nao cria sessao. A tela completa de redefinicao de senha ainda nao foi implementada; a resposta da API informa a necessidade de redefinir a senha sem expor hash, salt ou detalhes internos.

Hashes PBKDF2 com iteracoes fora do intervalo suportado sao tratados como credencial invalida antes da derivacao criptografica. Isso evita erro 500 em ambiente Workers e mantem a resposta sem detalhes sensiveis.

Fluxo local:

```bash
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Depois acesse `http://localhost:8787/admin/`.

## ERP Administrativo

O shell `/admin/` e uma central de acesso. Ele exibe, apos login:

- nome do usuario;
- hoteis autorizados;
- sistemas disponiveis conforme permissoes;
- logout compartilhado.

O shell `/admin/room-service/` exibe:

- tela de login;
- dashboard com indicadores, distribuicao por status, pedidos por hora e itens mais vendidos;
- lista de pedidos de Room Service;
- filtros por hotel, status e busca;
- detalhe de pedido com itens, totais, historico e situacao de impressao;
- mudanca de status controlada;
- editor de categorias e produtos com disponibilidade, ordenacao e imagens no R2;
- agenda semanal e controle manual de abertura ou fechamento;
- cadastro de quartos e acomodacoes validas por hotel;
- configuracoes em secoes para funcionamento, quartos, usuarios, conta, aparencia e notificacoes.

O funcionamento do Room Service usa `service_hours` no modo `automatic`. O setting publico `room-service.operation_mode` pode assumir `automatic`, `forced_open` ou `forced_closed`; o Worker aplica a mesma regra no bootstrap, na interface publica e na criacao do pedido. Esconder ou trocar o texto do botao no navegador nunca substitui essa validacao no servidor.

Quartos ativos em `rooms` sao publicados pela API e formam a lista de acomodacoes do pedido. Quartos inativos ou arquivados nao aparecem e nao sao aceitos pelo Worker. O cadastro e generico por `hotel_id`, sem numeracao fixa do Muller.

O editor de cardapio continua usando as tabelas compartilhadas `catalogs`, `categories`, `catalog_items` e `catalog_item_availability`. A migration `0015_erp_operations_catalog_profiles.sql` adiciona a referencia opcional entre item e `media_assets`, o ator operacional de uploads e a foto de perfil dos usuarios ERP. As imagens ficam no bucket privado e sao servidas somente por `/media/:id`.

O shell `/admin/portais/` e a Central de Portais Fioreze. A interface segue a mesma linguagem visual do ERP e oferece administracao multi-hotel para:

- listagem filtrada pelos hoteis autorizados ao usuario;
- criacao de unidade com `hotel_id` derivado do slug, sem aceitar `hotel_id` enviado pelo cliente;
- edicao de dados gerais, status e arquivamento logico;
- identidade visual com seletor de arquivos da Biblioteca de Midia e capa desktop em imagem ou video;
- configuracoes publicas de contato, hospedagem e SEO em `hotel_settings`;
- ativacao de modulos por hotel em `hotel_modules`;
- navegacao publica por hotel em `navigation_items`;
- configuracao oficial de incorporacao publica em `hotel_settings`;
- paginas e secoes editoriais em `portal_pages` e `portal_sections`;
- eventos e informacoes publicas em `events` e `hotel_information`;
- telas dedicadas para areas e navegacao por unidade;
- auditoria administrativa em `admin_audit_log`.

Em **Conteudos > Construtor**, a Central oferece um editor visual compartilhado para Portal do Hospede, Emporio, Spa, Pacotes Romanticos e modulos publicos futuros. O editor possui canvas desktop/mobile, blocos arrastaveis, camadas, estilos responsivos, Biblioteca de Midia, desfazer/refazer, modelos reutilizaveis, revisoes e publicacao separada do rascunho. O documento salvo e JSON estruturado e validado; nao e HTML executavel. A arquitetura e os controles estao documentados em `docs/arquitetura/VISUAL_PORTAL_BUILDER.md`.

O shell publico do Portal do Hospede e unico para todos os hoteis. Ele reproduz a composicao visual da referencia aprovada com identidade dinamica por unidade: carregamento com logo horizontal, cabecalho responsivo, navegacao inferior no mobile, servicos ilustrados, evento em destaque, lista e calendario de eventos, detalhe editorial, informacoes do hotel, clima e blog. Cores, tipografia, logos, modulos, imagens e conteudos continuam vindo do bootstrap e das APIs do hotel selecionado; nenhum HTML ou dado do Muller fica fixo no shell compartilhado.

A migration `0022_guest_portal_event_details.sql` amplia `events` de forma aditiva com descricao completa, local, categoria e tags. A migration `0023_guest_portal_event_actions.sql` acrescenta um botao editorial opcional por evento, formado por texto e URL HTTPS validados em conjunto. Esses campos sustentam a visualizacao editorial de eventos e podem ser administrados pela Central de Portais. As migrations nao cadastram nem alteram eventos existentes.

A Central tambem possui gestao completa de usuarios, senhas temporarias, sessoes, perfis e permissoes. Segredos temporarios sao exibidos uma unica vez e nunca sao gravados na auditoria.

O Inicio administrativo apresenta indicadores e graficos calculados a partir da sessao e das APIs atuais. Usuarios, perfis e permissoes, auditoria e Minha conta ficam reunidos em `/admin/configuracoes/`, sem remover a protecao individual de cada area.

A migration `0024_short_link_user_sharing.sql` torna cada link visivel somente para seu criador e para usuarios da mesma unidade escolhidos por ele. O acesso compartilhado permite visualizar detalhes, QR Code e metricas, mas editar, arquivar, excluir e gerenciar compartilhamentos continuam exclusivos do proprietario.

As APIs de Unidades exigem sessao administrativa, permissoes `portals.hotels.*`, acesso explicito ao hotel, protecao de origem e header administrativo para mutacoes. A migration `0009_admin_units_management_permissions.sql` cadastra as permissoes, mas nao associa roles automaticamente. O seed local pode liberar essas permissoes para o usuario ficticio de desenvolvimento.

## Incorporacao Publica

O modo embed publica modulos publicos em iframes controlados, sem expor a Central Administrativa:

- `/embed/:hotel_slug/:module_key/`;
- `/embed/:hotel_slug/:module_key/embed.js`;
- `/embed/:hotel_slug/:module_key/config`;
- `/embed/fioreze-embed.js`;
- `/api/v1/public/hotels/:hotel_slug/embed/:module_key/config`.

A configuracao fica em `hotel_settings` usando chaves `embed.*`. A allowlist aceita somente origens completas, sem caminho e sem wildcard. `localhost` e permitido apenas em desenvolvimento/testes. O modulo `admin` nunca e incorporavel.

As respostas `/embed/*` nao usam `X-Frame-Options`; elas usam `Content-Security-Policy` com `frame-ancestors` derivado das origens autorizadas. Rotas `/admin/*` continuam protegidas contra iframe.

O script de autoaltura envia apenas `fioreze:embed:ready` e `fioreze:embed:resize` via `postMessage`. O script hospedeiro valida `event.origin`, `event.data.type` e `embed_id` antes de ajustar altura.

Exemplo local:

```html
<iframe
  data-fioreze-embed
  data-fioreze-embed-id="fioreze-muller-fioreze-room-service"
  src="http://localhost:8787/embed/muller-fioreze/room-service/"
  width="100%"
  height="560"
  loading="lazy"
  style="border:0;width:100%;max-width:100%;"></iframe>
<script src="http://localhost:8787/embed/fioreze-embed.js" defer></script>
```

Fluxo de status exposto pela API:

```text
received -> preparing -> ready -> completed
received|preparing|ready -> cancelled
```

Por compatibilidade com o schema atual, `completed` e persistido em `orders.status` como `delivered` e traduzido de volta para `completed` nas APIs administrativas. Uma migration futura pode alinhar o CHECK do banco para aceitar `completed` diretamente.

Cancelamento exige nota. Toda mudanca valida registra `order_status_history` e `admin_audit_log`. Repetir a mesma mudanca nao cria historico duplicado.

As mudancas de status usam `UPDATE` otimista pelo status anterior. Historico e auditoria usam `INSERT ... SELECT` condicionados ao pedido estar no status alvo, no mesmo hotel/modulo e com `updated_at` igual ao horario daquela requisicao. A API tambem verifica `meta.changes` do `UPDATE`: se zero linhas forem alteradas, os inserts condicionais nao devem gravar nada e a rota rele o pedido.

A migration `0007_admin_orders_guards.sql` adiciona o indice unico `uq_order_status_history_order_status` para garantir no banco que cada pedido tenha no maximo um historico por status. Antes de aplicar essa migration em qualquer D1 compartilhado, executar a pre-verificacao:

```sql
SELECT order_id, status, COUNT(*) AS total
FROM order_status_history
GROUP BY order_id, status
HAVING COUNT(*) > 1;
```

Se duas requisicoes simultaneas solicitarem o mesmo status, a vencedora grava status, historico e auditoria; a perdedora rele o pedido e retorna `idempotent=true` quando o status ja estiver aplicado. Se duas requisicoes concorrentes solicitarem destinos diferentes, apenas a vencedora grava historico/auditoria e a perdedora recebe `409 conflict` com o status atual. Nenhuma rota de status cria `print_events`.

## Impressao

Impressao permanece desativada com `IMPRESSION_ENABLED=false`. O `PrintProvider` e apenas uma interface inicial. Nenhuma rota chama servidor antigo, Python, localhost, impressora, Apps Script ou planilha.

No ERP, a mensagem exibida e `Impressao desativada neste ambiente.`. Mudar status nao cria `print_events` nem aciona qualquer recurso externo.

## Ainda Falta Migrar

- integracao do Portal do Hospede principal com paginas adicionais criadas no Construtor Visual;
- Emporio funcional;
- Spa funcional;
- Pacotes Romanticos funcionais;
- ERP administrativo completo;
- relatorios administrativos exportaveis;
- perfis de permissao reutilizaveis para equipes operacionais;
- integracao futura de impressao;
- deploy Cloudflare;
- dados reais via processo controlado de migracao.

## Restricoes

Esta fase nao acessou producao, D1 remoto, Cloudflare remoto, Apps Script, Google Sheets, servidor de impressao ou impressoras.
