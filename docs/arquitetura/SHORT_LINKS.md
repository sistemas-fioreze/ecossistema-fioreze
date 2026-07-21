# Links Personalizados

O modulo oficial de links personalizados pertence a Central de Portais e cria URLs curtas compartilhadas entre hoteis. Cada link pertence a um `hotel_id` e so pode ser administrado por usuarios com acesso ao hotel.

## Estado Atual

O endereco publico padrao dos links e:

`https://go.hoteisfioreze.com.br/<slug>`

O hostname `go.hoteisfioreze.com.br` e administrado no DNS externo e aponta por CNAME para o projeto `fioreze-portais-pages-dev`. O Pages recebe esse hostname e executa o mesmo Worker em modo avancado. Nao foi necessario transferir a zona, trocar nameservers ou alterar o dominio raiz.

O endereco tecnico continua disponivel como contingencia:

`https://fioreze-portais-dev.marketing1-840.workers.dev/go/<slug>`

## Uso

- Crie links em `/admin/portais/links/`.
- O `slug` e global, imutavel e aceita apenas letras minusculas, numeros e hifens.
- O destino pode ser alterado depois da criacao sem mudar o link publico.
- Links podem ficar `active`, `paused` ou `archived`.
- `starts_at` e `expires_at` permitem publicar campanhas temporarias.
- Links pausados, arquivados, futuros ou expirados respondem como 404 generico.
- A tela administrativa exibe, antecipa e copia o `public_url` retornado pela API usando o dominio oficial.
- Cada link fica visivel somente para seu criador ate que ele compartilhe o acesso com outra pessoa da mesma unidade.

## Propriedade e Compartilhamento

`short_links.created_by_user_id` define o proprietario do link. Listagem, detalhes, QR Code e analytics aceitam somente o proprietario ou um usuario presente em `short_link_user_shares`.

- O proprietario pode editar, pausar, reativar, arquivar, excluir e gerenciar compartilhamentos.
- Um usuario compartilhado recebe acesso de visualizacao: pode abrir os detalhes, copiar o endereco, gerar o QR Code e consultar metricas quando tiver as permissoes administrativas correspondentes.
- O acesso compartilhado nao permite editar, arquivar, excluir nem compartilhar novamente.
- Somente usuarios ativos que tambem possuam acesso ao `hotel_id` do link podem ser convidados.
- Revogar o compartilhamento remove imediatamente o link da listagem e dos endpoints autenticados do usuario.
- Compartilhar e revogar geram `short-link.share` e `short-link.share-revoke` na auditoria.

## Destinos Permitidos

Sao aceitos somente destinos absolutos com os esquemas:

- `https`
- `http`
- `mailto`
- `tel`

WhatsApp deve usar `https://wa.me/...`. Mapas, motores de reserva, landing pages e URLs de campanha tambem devem usar URLs absolutas. HTTP e permitido para compatibilidade, mas a interface deve alertar que HTTPS e recomendado.

Sao bloqueados:

- `javascript:`, `data:`, `file:`, `vbscript:`, `blob:`;
- URLs relativas;
- URLs vazias;
- URLs com credenciais embutidas;
- caracteres de controle ou quebras de linha;
- loops diretos para a propria origem em `/go/<slug>`;
- loops diretos para o dominio oficial em `/<slug>` ou `/go/<slug>`;
- URLs maiores que 4096 caracteres.

O sistema nao faz `fetch`, `HEAD` ou validacao DNS do destino. Isso evita SSRF e impede que a administracao acesse recursos internos ao validar um link.

## Redirect Publico

`GET /go/:slug` no Workers.dev retorna `302` para o destino cadastrado quando o link esta ativo e dentro da janela de validade.

`GET https://go.hoteisfioreze.com.br/:slug` usa a mesma regra sem exigir `/go/`.

Headers publicos:

- `Cache-Control: no-store`;
- `X-Robots-Tag: noindex, nofollow`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- sem cookies;
- sem dados administrativos.

`HEAD` usa a mesma regra de disponibilidade, mas nao registra clique.

A query enviada pelo visitante ao link curto nao e anexada ao destino salvo. O redirect sempre usa exatamente `destination_url`.

## Isolamento do Hostname

Com `SHORT_LINK_PUBLIC_ORIGIN=https://go.hoteisfioreze.com.br`, esse hostname funciona exclusivamente como redirecionador.

Permitido:

- `GET /<slug>`;
- `HEAD /<slug>`;
- uma barra final opcional em `/<slug>/`.

Bloqueado com 404 generico:

- `/`;
- `/admin`, `/admin/`;
- `/api`, `/api/v1/health`;
- `/media`, `/embed`, `/assets`, `/css`, `/js`;
- `/go`, `/go/<slug>`;
- `/login`, `/logout`;
- `/favicon.ico`, `/robots.txt`, `/sitemap.xml`;
- `/cdn-cgi`, `/.well-known`;
- caminhos com mais de um segmento;
- metodos diferentes de `GET` e `HEAD`;
- slugs reservados ou codificados que resolvam para reservados.

O 404 do dominio curto retorna JSON, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, sem cookies e sem fallback HTML do SPA.

## Analytics e Privacidade

A cada `GET` redirecionado, o Worker incrementa:

- `short_links.total_clicks`;
- `short_links.last_clicked_at`;
- `short_link_clicks_daily.click_count`.

As metricas sao agregadas por dia UTC. O sistema nao armazena IP, user-agent, referrer, query do visitante, cookies, e-mail ou identificadores pessoais do visitante.

Falha de analytics nao deve bloquear o redirect.

## QR Code

A Central gera o QR Code diretamente a partir do `public_url` calculado pelo backend. O QR nao cria uma segunda URL e nao duplica dados: ele representa exatamente o link curto atual.

- `GET /api/v1/admin/short-links/:id/qrcode.svg` exibe o SVG autenticado;
- `?download=1` entrega o mesmo SVG como arquivo;
- a resposta usa `Cache-Control: no-store`;
- a geracao funciona offline no Worker e nao envia a URL para servicos externos.

Links ativos, pausados e arquivados mantem o QR disponivel para consulta administrativa. A disponibilidade publica continua sendo determinada pelo status do link.

## Dominio Oficial

O dominio oficial ativo e:

`https://go.hoteisfioreze.com.br`

As configuracoes do Worker e do Pages mantem:

- `workers_dev=true`;
- sem `routes[].pattern=go.hoteisfioreze.com.br`;
- `SHORT_LINK_PUBLIC_ORIGIN=https://go.hoteisfioreze.com.br`;
- `assets.run_worker_first` contendo `/*`, que inclui a rota `/go/*`.

Nao existe uma rota Custom Domain no `fioreze-portais-dev`: o hostname oficial entra pelo projeto Pages, enquanto o Worker continua publicado em `workers.dev`. O DNS externo deve manter somente o CNAME do hostname `go` para `fioreze-portais-pages-dev.pages.dev`. Nenhuma configuracao do dominio raiz ou de `www` faz parte deste fluxo.

## Permissoes

- `portals.links.read`
- `portals.links.create`
- `portals.links.update`
- `portals.links.archive`
- `portals.links.delete`
- `portals.links.analytics`

Mutacoes exigem sessao administrativa, permissao, acesso ao hotel, header administrativo e origem valida.

A exclusao definitiva exige `portals.links.delete` e somente e aceita depois que o link foi arquivado. A remocao apaga as metricas diarias vinculadas por cascata, preserva um registro de auditoria e nao afeta outros hoteis.

## Auditoria

Acoes registradas:

- `short-link.create`
- `short-link.update`
- `short-link.archive`
- `short-link.delete`
- `short-link.share`
- `short-link.share-revoke`

A auditoria registra entidade, ID, hotel, slug, campos alterados e usuario. O destino completo nao e gravado no audit log para reduzir risco de expor tokens ou parametros sensiveis.

## Troubleshooting

- Se `/go/:slug` retornar HTML do SPA no Workers.dev, confirme `assets.run_worker_first` contendo `/*`.
- Se `go.hoteisfioreze.com.br/<slug>` nao resolver, confirme o CNAME externo para `fioreze-portais-pages-dev.pages.dev` e o Custom Domain no projeto Pages.
- Se `go.hoteisfioreze.com.br/<slug>` retornar HTML, confirme `SHORT_LINK_PUBLIC_ORIGIN` no Pages e se a versao publicada contem o roteamento exclusivo por hostname.
- Se o certificado estiver pendente, aguarde o status do dominio no Pages antes de considerar rollback.
- Se um link ativo retornar 404, verifique `status`, `starts_at`, `expires_at` e `archived_at`.
- Se um link pausado ou expirado retornar 404, esse e o comportamento esperado.
- Se uma mutacao administrativa retornar 403, confira header `x-fioreze-admin-action` e origem.
- Se retornar 401, confira sessao, permissao e acesso ao hotel.
- Se analytics nao aumentar, confira se a chamada foi `GET`; `HEAD` nao incrementa cliques.

## Rollback

Se o dominio curto falhar, o endereco tecnico `workers.dev/go/<slug>` continua sendo a contingencia. Restaure a versao anterior do Pages ou remova temporariamente `SHORT_LINK_PUBLIC_ORIGIN`; nao alterar D1, R2, pedidos, imagens, usuarios, sessoes nem registros DNS de outros hostnames.
