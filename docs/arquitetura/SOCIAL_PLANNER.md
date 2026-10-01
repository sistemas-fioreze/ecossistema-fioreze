# Fioreze Social Planner

O Social Planner é um módulo administrativo do Worker compartilhado, servido em
`/admin/social-planner/week`. A interface em TypeScript fica em
`app/social-planner/` e é compilada para o asset estático
`app/public/js/modules/social-planner/planner.js` pelo esbuild já usado no
repositório. Não usa uma aplicação separada nem credenciais no navegador.

## Dados e segurança

- A migration `0052_social_planner.sql` cria os perfis editoriais, categorias,
  pilares, campanhas, sequências e Stories. O perfil editorial aponta para
  `hotels.id`; o nome e o Instagram do planner ficam em `social_planner_hotels`
  para preservar os dados operacionais das unidades existentes.
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

A interface usa um `StoryRepository` para concentrar chamadas e atualizar a
semana em memória após criação, edição e arraste. Movimentos otimistas são
revertidos e mostram aviso quando a API falha. A visão mensal e Pendências usam
os mesmos componentes e registros.

## Desenvolvimento local

No diretório `app/`, execute `npm install`, `npm run db:migrate:local`,
`npm run db:seed:local` e `npm run dev`. `predev` compila o TypeScript. Para
validar: `npm run social:typecheck`, `npm run pages:check` e `npm test`.
Nenhuma migration remota é executada por esses comandos. A aplicação publicada
precisará da migration `0052` no D1 do ambiente escolhido e de permissões
atribuídas aos perfis administrativos reais.
