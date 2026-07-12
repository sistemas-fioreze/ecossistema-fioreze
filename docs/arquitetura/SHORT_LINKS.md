# Links Personalizados

O modulo oficial de links personalizados pertence a Central de Portais e cria URLs curtas no dominio oficial `https://go.hoteisfioreze.com.br`.

Formato publico definitivo:

`https://go.hoteisfioreze.com.br/<slug>`

O formato tecnico `https://fioreze-portais-dev.marketing1-840.workers.dev/go/<slug>` permanece disponivel no ambiente de desenvolvimento para compatibilidade e diagnostico. O modulo e compartilhado entre hoteis, mas cada link pertence a um `hotel_id` e so pode ser administrado por usuarios com acesso ao hotel.

## Uso

- Crie links em `/admin/portais/links/`.
- O `slug` e global, imutavel e aceita apenas letras minusculas, numeros e hifens.
- O destino pode ser alterado depois da criacao sem mudar o link publico.
- Links podem ficar `active`, `paused` ou `archived`.
- `starts_at` e `expires_at` permitem publicar campanhas temporarias.
- Links pausados, arquivados, futuros ou expirados respondem como 404 generico.
- A tela administrativa exibe e copia a URL oficial `https://go.hoteisfioreze.com.br/<slug>`.

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

`GET https://go.hoteisfioreze.com.br/:slug` retorna `302` para o destino cadastrado quando o link esta ativo e dentro da janela de validade.

`GET /go/:slug` continua funcionando no Workers.dev de desenvolvimento com a mesma regra.

Headers publicos:

- `Cache-Control: no-store`;
- `X-Robots-Tag: noindex, nofollow`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- sem cookies;
- sem dados administrativos.

`HEAD` usa a mesma regra de disponibilidade, mas nao registra clique.

A query enviada pelo visitante ao dominio curto nao e anexada ao destino salvo. O redirect sempre usa exatamente `destination_url`.

## Isolamento do Hostname

O hostname `go.hoteisfioreze.com.br` funciona exclusivamente como redirecionador.

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

O MVP nao gera QR Code nativo. Para campanhas, use ferramentas externas apontando para a URL curta. Futuramente a plataforma pode gerar QR Codes com base no mesmo `/go/<slug>`.

## Dominio Oficial e Custom Domain

O dominio oficial e configurado pelo Worker como Custom Domain:

`https://go.hoteisfioreze.com.br`

Configuracao esperada:

- `SHORT_LINK_PUBLIC_ORIGIN=https://go.hoteisfioreze.com.br`;
- `routes[].pattern=go.hoteisfioreze.com.br`;
- `routes[].custom_domain=true`;
- `assets.run_worker_first` contendo `/go/*`.

DNS e certificado TLS sao gerenciados pela Cloudflare a partir do Custom Domain. Nao criar CNAME manual para este hostname enquanto o Custom Domain estiver ativo.

## Permissoes

- `portals.links.read`
- `portals.links.create`
- `portals.links.update`
- `portals.links.archive`
- `portals.links.analytics`

Mutacoes exigem sessao administrativa, permissao, acesso ao hotel, header administrativo e origem valida.

## Auditoria

Acoes registradas:

- `short-link.create`
- `short-link.update`
- `short-link.archive`

A auditoria registra entidade, ID, hotel, slug, campos alterados e usuario. O destino completo nao e gravado no audit log para reduzir risco de expor tokens ou parametros sensiveis.

## Troubleshooting

- Se `/go/:slug` retornar HTML do SPA no Workers.dev, confirme `assets.run_worker_first` contendo `/go/*`.
- Se `go.hoteisfioreze.com.br/<slug>` retornar HTML, confirme que o Custom Domain esta apontado para `fioreze-portais-dev` e que o roteamento exclusivo por hostname esta ativo.
- Se o certificado estiver pendente, aguarde o status oficial do Custom Domain antes de considerar rollback.
- Se houver conflito de DNS, nao sobrescrever registros existentes sem auditoria; remova apenas um Custom Domain recem-criado se o rollback exigir.
- Se um link ativo retornar 404, verifique `status`, `starts_at`, `expires_at` e `archived_at`.
- Se um link pausado ou expirado retornar 404, esse e o comportamento esperado.
- Se uma mutacao administrativa retornar 403, confira header `x-fioreze-admin-action` e origem.
- Se retornar 401, confira sessao, permissao e acesso ao hotel.
- Se analytics nao aumentar, confira se a chamada foi `GET`; `HEAD` nao incrementa cliques.

## Rollback

Se o dominio curto quebrar o Workers.dev, restaure a versao anterior do Worker e remova somente o Custom Domain recem-criado. Nao alterar D1, R2, pedidos, imagens, usuarios, sessoes nem registros DNS de outros hostnames.
