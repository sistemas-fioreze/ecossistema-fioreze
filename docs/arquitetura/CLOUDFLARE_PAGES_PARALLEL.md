# Cloudflare Pages Paralelo

## Objetivo

A plataforma pode ser publicada em um projeto Cloudflare Pages separado sem substituir o Worker `fioreze-portais-dev`. O Pages usa Pages Functions em modo avancado por meio de `_worker.js`, reutilizando o mesmo codigo de `app/src/index.js` e os mesmos arquivos de `app/public/`.

Esta configuracao nao cria, remove ou redireciona o Worker atual. Os dois endpoints podem coexistir durante a validacao.

## Build

Configuracao do projeto Pages:

| Campo | Valor |
| --- | --- |
| Nome sugerido | `fioreze-portais-pages-dev` |
| Diretorio raiz | `app` |
| Comando de build | `npm run pages:build` |
| Diretorio de build | `pages/dist` |
| Branch de producao | definir somente ao ativar a integracao Git |

O build copia `public/` para `pages/dist/`, gera o bundle `pages/dist/_worker.js` e cria `pages/dist/_routes.json`. O arquivo de rotas envia `/*` para o `_worker.js`; o codigo decide entre API, midia, links, shells administrativos e `env.ASSETS`, preservando os redirects e fallbacks atuais.

O arquivo `pages/wrangler.jsonc` fica em uma raiz propria porque o Wrangler Pages nao aceita `--config` com caminho alternativo. Os scripts `pages:dev` e `pages:deploy` entram nessa raiz por um lancador Node multiplataforma, sem carregar ou alterar o `wrangler.jsonc` do Worker.

O diretorio `dist/` e temporario e permanece ignorado pelo Git.

## Bindings

Cadastre os bindings tanto em **Production** quanto em **Preview** no projeto Pages:

| Tipo | Nome da variavel | Recurso de desenvolvimento |
| --- | --- | --- |
| D1 | `DB` | `fioreze-portais-db-dev` |
| R2 | `MEDIA_BUCKET` | `fioreze-portais-media-dev` |

O binding `ASSETS` e fornecido automaticamente pelo Pages ao `_worker.js`; ele nao precisa ser criado manualmente.

Variaveis obrigatorias:

| Nome | Valor |
| --- | --- |
| `ENVIRONMENT` | `development` |
| `IMPRESSION_ENABLED` | `false` |
| `DEFAULT_HOTEL_SLUG` | `muller-fioreze` |

Nao cadastre segredos no repositorio. Se uma variavel secreta for necessaria no futuro, use **Settings > Variables and Secrets** no projeto Pages.

## Configuracao Pelo Dashboard

1. Abra **Workers & Pages** e crie um projeto Pages novo.
2. Use um nome diferente de `fioreze-portais-dev`; o nome sugerido e `fioreze-portais-pages-dev`.
3. Selecione o repositorio `sistemas-fioreze/ecossistema-fioreze`.
4. Configure a raiz como `app`, o build como `npm run pages:build` e a saida como `pages/dist`.
5. Cadastre `DB`, `MEDIA_BUCKET` e as tres variaveis de desenvolvimento.
6. Confirme os bindings nos ambientes Production e Preview.
7. Publique primeiro como URL `pages.dev`, sem dominio personalizado ou DNS.
8. Valide rotas, autenticacao, midia e isolamento por hotel antes de qualquer trafego oficial.

Nao altere a rota, o nome, os bindings ou o dominio do Worker atual durante essa ativacao.

## Comandos

```bash
cd app
npm ci
npm run pages:build
npm run pages:check
npm run pages:dev
```

O desenvolvimento local usa bindings locais do Wrangler. O comando de deploy remoto existe para a etapa controlada posterior:

```bash
npm run pages:deploy -- --branch main
```

Esse comando deve ser executado somente depois que o projeto Pages separado existir e os bindings forem revisados. Ele nao executa migration, seed ou deploy do Worker `fioreze-portais-dev`.

## Paridade E Rollback

- `wrangler.jsonc` continua sendo a configuracao exclusiva do Worker atual.
- `pages/wrangler.jsonc` e exclusiva do projeto Pages paralelo.
- ambos usam `DB` e `MEDIA_BUCKET` com os mesmos nomes;
- nenhuma migration e aplicada pelo build ou deploy Pages;
- o Pages pode ser desativado sem afetar o Worker;
- o rollback do Pages consiste em promover uma implantacao Pages anterior ou interromper o projeto Pages, mantendo o Worker atual disponivel.
