# Links Personalizados

O modulo oficial de links personalizados pertence a Central de Portais e cria URLs curtas no formato `/go/<slug>`. Ele e compartilhado entre hoteis, mas cada link pertence a um `hotel_id` e so pode ser administrado por usuarios com acesso ao hotel.

## Uso

- Crie links em `/admin/portais/links/`.
- O `slug` e global, imutavel e aceita apenas letras minusculas, numeros e hifens.
- O destino pode ser alterado depois da criacao sem mudar o link publico.
- Links podem ficar `active`, `paused` ou `archived`.
- `starts_at` e `expires_at` permitem publicar campanhas temporarias.
- Links pausados, arquivados, futuros ou expirados respondem como 404 generico.

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
- URLs maiores que 4096 caracteres.

O sistema nao faz `fetch`, `HEAD` ou validacao DNS do destino. Isso evita SSRF e impede que a administracao acesse recursos internos ao validar um link.

## Redirect Publico

`GET /go/:slug` retorna `302` para o destino cadastrado quando o link esta ativo e dentro da janela de validade.

Headers publicos:

- `Cache-Control: no-store`;
- `X-Robots-Tag: noindex, nofollow`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- sem cookies;
- sem dados administrativos.

`HEAD /go/:slug` usa a mesma regra de disponibilidade, mas nao registra clique.

## Analytics e Privacidade

A cada `GET` redirecionado, o Worker incrementa:

- `short_links.total_clicks`;
- `short_links.last_clicked_at`;
- `short_link_clicks_daily.click_count`.

As metricas sao agregadas por dia UTC. O sistema nao armazena IP, user-agent, referrer, query do visitante, cookies, e-mail ou identificadores pessoais do visitante.

Falha de analytics nao deve bloquear o redirect.

## QR Code

O MVP nao gera QR Code nativo. Para campanhas, use ferramentas externas apontando para a URL curta. Futuramente a plataforma pode gerar QR Codes com base no mesmo `/go/<slug>`.

## Dominio Curto Futuro

Hoje o preview usa `window.location.origin + "/go/" + slug`. Futuramente a variavel `SHORT_LINK_PUBLIC_ORIGIN` podera apontar para algo como:

`https://go.hoteisfioreze.com.br`

Nenhum dominio foi configurado nesta fase.

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

- Se `/go/:slug` retornar HTML do SPA, confirme `assets.run_worker_first` contendo `/go/*`.
- Se um link ativo retornar 404, verifique `status`, `starts_at`, `expires_at` e `archived_at`.
- Se uma mutacao administrativa retornar 403, confira header `x-fioreze-admin-action` e origem.
- Se retornar 401, confira sessao, permissao e acesso ao hotel.
- Se analytics nao aumentar, confira se a chamada foi `GET`; `HEAD` nao incrementa cliques.
