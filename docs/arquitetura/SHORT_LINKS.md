# Links Personalizados

O modulo oficial de links personalizados pertence a Central de Portais e cria URLs curtas compartilhadas entre hoteis. Cada link pertence a um `hotel_id` e so pode ser administrado por usuarios com acesso ao hotel.

## Estado Atual

A operacao atual em desenvolvimento usa o endereco tecnico do Worker:

`https://fioreze-portais-dev.marketing1-840.workers.dev/go/<slug>`

O dominio oficial planejado e:

`https://go.hoteisfioreze.com.br/<slug>`

A ativacao do dominio oficial esta adiada porque a zona `hoteisfioreze.com.br` nao esta disponivel na conta Cloudflare atual. O DNS provavelmente e gerenciado externamente pela KingHost ou por outra controladoria. O codigo ja preserva suporte opcional a `SHORT_LINK_PUBLIC_ORIGIN` e ao hostname exclusivo, mas a configuracao padrao nao ativa esse dominio.

## Uso

- Crie links em `/admin/portais/links/`.
- O `slug` e global, imutavel e aceita apenas letras minusculas, numeros e hifens.
- O destino pode ser alterado depois da criacao sem mudar o link publico.
- Links podem ficar `active`, `paused` ou `archived`.
- `starts_at` e `expires_at` permitem publicar campanhas temporarias.
- Links pausados, arquivados, futuros ou expirados respondem como 404 generico.
- A tela administrativa exibe e copia o `public_url` retornado pela API. Enquanto `SHORT_LINK_PUBLIC_ORIGIN` estiver ausente, esse valor usa o formato tecnico `/go/<slug>` no `workers.dev`.

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
- loops diretos para o dominio oficial futuro em `/<slug>` ou `/go/<slug>` quando `SHORT_LINK_PUBLIC_ORIGIN` estiver configurada;
- URLs maiores que 4096 caracteres.

O sistema nao faz `fetch`, `HEAD` ou validacao DNS do destino. Isso evita SSRF e impede que a administracao acesse recursos internos ao validar um link.

## Redirect Publico

`GET /go/:slug` no Workers.dev retorna `302` para o destino cadastrado quando o link esta ativo e dentro da janela de validade.

Quando o dominio oficial for ativado futuramente, `GET https://go.hoteisfioreze.com.br/:slug` devera usar a mesma regra sem exigir `/go/`.

Headers publicos:

- `Cache-Control: no-store`;
- `X-Robots-Tag: noindex, nofollow`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- sem cookies;
- sem dados administrativos.

`HEAD` usa a mesma regra de disponibilidade, mas nao registra clique.

A query enviada pelo visitante ao link curto nao e anexada ao destino salvo. O redirect sempre usa exatamente `destination_url`.

## Isolamento do Hostname

Quando `SHORT_LINK_PUBLIC_ORIGIN` estiver configurada para `https://go.hoteisfioreze.com.br`, esse hostname funciona exclusivamente como redirecionador.

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

## Dominio Oficial e Custom Domain Futuro

O dominio oficial planejado e:

`https://go.hoteisfioreze.com.br`

Ele nao esta ativo na configuracao padrao atual. A configuracao atual deve manter:

- `workers_dev=true`;
- sem `routes[].pattern=go.hoteisfioreze.com.br`;
- sem `SHORT_LINK_PUBLIC_ORIGIN`;
- `assets.run_worker_first` contendo `/go/*`.

Para ativar o dominio no futuro, primeiro e necessario confirmar acesso administrativo a zona DNS `hoteisfioreze.com.br` ou coordenar a controladoria externa. Somente depois disso, uma nova mudanca deve configurar:

- `SHORT_LINK_PUBLIC_ORIGIN=https://go.hoteisfioreze.com.br`;
- `routes[].pattern=go.hoteisfioreze.com.br`;
- `routes[].custom_domain=true`;
- `assets.run_worker_first` contendo `/go/*`.

DNS e certificado TLS devem ser gerenciados pela Cloudflare a partir do Custom Domain quando a zona estiver acessivel. Esta etapa nao instrui troca de nameservers, mudanca no dominio raiz, alteracao de `www` ou edicao manual de registros fora do hostname `go`.

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

A auditoria registra entidade, ID, hotel, slug, campos alterados e usuario. O destino completo nao e gravado no audit log para reduzir risco de expor tokens ou parametros sensiveis.

## Troubleshooting

- Se `/go/:slug` retornar HTML do SPA no Workers.dev, confirme `assets.run_worker_first` contendo `/go/*`.
- Se `go.hoteisfioreze.com.br/<slug>` nao resolver, confirme primeiro se a zona `hoteisfioreze.com.br` esta acessivel na conta Cloudflare correta ou se depende de controladoria externa.
- Se `go.hoteisfioreze.com.br/<slug>` retornar HTML depois da ativacao futura, confirme que o Custom Domain esta apontado para `fioreze-portais-dev` e que o roteamento exclusivo por hostname esta ativo.
- Se o certificado estiver pendente, aguarde o status oficial do Custom Domain antes de considerar rollback.
- Se houver conflito de DNS, nao sobrescrever registros existentes sem auditoria; remova apenas um Custom Domain recem-criado se o rollback exigir.
- Se um link ativo retornar 404, verifique `status`, `starts_at`, `expires_at` e `archived_at`.
- Se um link pausado ou expirado retornar 404, esse e o comportamento esperado.
- Se uma mutacao administrativa retornar 403, confira header `x-fioreze-admin-action` e origem.
- Se retornar 401, confira sessao, permissao e acesso ao hotel.
- Se analytics nao aumentar, confira se a chamada foi `GET`; `HEAD` nao incrementa cliques.

## Rollback

Se o dominio curto quebrar o Workers.dev em uma ativacao futura, restaure a versao anterior do Worker e remova somente o Custom Domain recem-criado. Nao alterar D1, R2, pedidos, imagens, usuarios, sessoes nem registros DNS de outros hostnames.
