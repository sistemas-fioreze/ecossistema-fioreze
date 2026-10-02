# Fioreze Marketing Planner

O Marketing Planner é um módulo administrativo do Worker compartilhado, servido em
`/admin/social-planner/overview`. A interface em TypeScript fica em
`app/social-planner/` e é compilada para o asset estático
`app/public/js/modules/social-planner/planner.js` pelo esbuild já usado no
repositório. Não usa uma aplicação separada nem credenciais no navegador.
`/socialplanner` é um atalho no mesmo domínio para a visão geral e preserva
os parâmetros de filtro na URL.

## Dados e segurança

- A migration `0059_social_planner.sql` cria os perfis editoriais, categorias,
  pilares, campanhas, sequências e Stories. O perfil editorial aponta para
  `hotels.id`; o nome e o Instagram do planner ficam em `social_planner_hotels`
  para preservar os dados operacionais das unidades existentes.
- A migration `0060_marketing_planner.sql` cria visitas, checklist, vínculo
  reutilizável com `media_assets`, artigos do Blog e `source_visit_id` opcional
  em Stories. Os três domínios compartilham hotéis, categorias, campanhas e
  usuários por chave estrangeira. O nome exibido fica em
  `marketing_planner_settings`.
- `responsible_user_id` aponta para `admin_users`. A sessão administrativa
  existente protege todas as rotas. `social-planner.read` e
  `social-planner.write` são permissões próprias; apenas a role fictícia local
  recebe ambas automaticamente no seed. Conceda permissões reais pela gestão
  de perfis antes do uso pela equipe.
- `media_asset_id` aponta para a biblioteca de mídia existente. O D1 guarda
  somente metadados e o Worker serve arquivos por `/media/:id`; o planner não
  acessa R2 diretamente. O seletor usa a API administrativa de mídia e respeita
  as permissões e o acesso à unidade da biblioteca.
- O servidor valida campos, datas, referências e URLs HTTPS. Todas as
  consultas SQL são parametrizadas. Mutação exige cabeçalho administrativo e
  origem compatível. As respostas são `no-store`.

## API

Prefixo: `/api/v1/admin/social-planner`.

- `GET /hotels`, `/categories`, `/pillars`, `/users`, `/campaigns`, `/sequences`
- `GET /stories?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` com filtros
  opcionais `hotel_id`, `status`, `category_id`, `responsible_user_id` e
  `campaign_id`. A janela máxima é de 93 dias.
- `GET /stories/:id`, `POST /stories`, `PATCH /stories/:id`, `DELETE /stories/:id`
- `POST /campaigns`, `PATCH /campaigns/:id`
- `POST /sequences`, `PATCH /sequences/:id/move`,
  `POST /sequences/:id/duplicate`
- `GET/POST /visits`, `GET/PATCH/DELETE /visits/:id`, endpoints de itens do
  checklist e associação de mídias existentes. As listagens usam intervalo e
  filtros por hotel, status, pessoa e campanha.
- `GET/POST /blog-posts`, `GET/PATCH/DELETE /blog-posts/:id`, com filtros por
  período, hotel, status, categoria, autor e campanha.
- `GET/PATCH /settings` para o nome exibido.

A interface concentra chamadas em repositórios e separa as visões de visitas,
blog e dashboard em arquivos próprios. Stories e visitas são lidos por janela
de datas. Movimentos otimistas na semana social e no Kanban do Blog são
revertidos com aviso quando a API falha. Uma página futura de hotel pode
consultar os três domínios por `hotel_id` sem alterar o modelo de dados.

## Desenvolvimento local

No diretório `app/`, execute `npm install`, `npm run db:migrate:local`,
`npm run db:seed:local` e `npm run dev`. `predev` compila o TypeScript. Para
validar: `npm run social:typecheck`, `npm run pages:check` e `npm test`.
Nenhuma migration remota é executada por esses comandos. A aplicação publicada
precisará das migrations `0059` e `0060` no D1 do ambiente escolhido e de permissões
atribuídas aos perfis administrativos reais.

## Prévia isolada no Worker de desenvolvimento

O workflow `preview-marketing-planner.yml` valida a branch do Planner e envia uma
nova versão com `wrangler versions upload`. A versão recebe o alias
`marketing-planner`, mas não é distribuída ao tráfego ativo do Worker. Essa
prévia usa os bindings de desenvolvimento existentes, incluindo D1 e R2. O
workflow não executa migrations; elas devem estar aplicadas antes do teste.
Não promova a versão para o tráfego ativo antes de reconciliar as mudanças do
Worker publicado com o código-fonte do repositório.
