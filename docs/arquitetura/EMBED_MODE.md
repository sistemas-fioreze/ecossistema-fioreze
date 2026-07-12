# Modo oficial de incorporacao

O modo de incorporacao publica permite exibir modulos publicos do Ecossistema Fioreze em sites autorizados, sem expor a Central Administrativa e sem duplicar HTML por hotel.

## Rotas

- `GET /embed/:hotel_slug/:module_key/`: shell publico do iframe.
- `GET /embed/:hotel_slug/:module_key/embed.js`: inicializador interno do iframe.
- `GET /embed/:hotel_slug/:module_key/config`: configuracao publica do embed.
- `GET /embed/fioreze-embed.js`: script opcional para autoaltura no site hospedeiro.
- `GET /api/v1/public/hotels/:hotel_slug/embed/:module_key/config`: API publica versionada.

`admin` nunca e um modulo incorporavel.

## Configuracao por unidade

A configuracao fica em `hotel_settings`:

- `embed.enabled`
- `embed.allowed_origins`
- `embed.allowed_modules`
- `embed.default_theme`
- `embed.default_background`
- `embed.header`
- `embed.initial_height`
- `embed.compact`

As origens autorizadas devem ser origens completas, como `https://site.example`, sem caminho, query string ou wildcard. `localhost` e permitido apenas em desenvolvimento.

## Exemplos

Iframe simples:

```html
<iframe
  src="https://fioreze-portais-dev.workers.dev/embed/muller-fioreze/room-service/"
  width="100%"
  height="560"
  loading="lazy"
  style="border:0;width:100%;max-width:100%;"></iframe>
```

Iframe com autoaltura:

```html
<iframe
  data-fioreze-embed
  data-fioreze-embed-id="fioreze-muller-fioreze-room-service"
  src="https://fioreze-portais-dev.workers.dev/embed/muller-fioreze/room-service/"
  width="100%"
  height="560"
  loading="lazy"
  style="border:0;width:100%;max-width:100%;"></iframe>
<script src="https://fioreze-portais-dev.workers.dev/embed/fioreze-embed.js" defer></script>
```

Tema claro, fundo transparente e cabecalho oculto:

```html
<iframe
  src="https://fioreze-portais-dev.workers.dev/embed/muller-fioreze/room-service/?theme=light&background=transparent&header=hidden"
  width="100%"
  height="560"
  loading="lazy"
  style="border:0;width:100%;max-width:100%;"></iframe>
```

No WordPress ou Elementor, use um bloco HTML personalizado e cole o codigo gerado pela Central de Portais. O dominio do site precisa estar em `Dominios autorizados`.

## Seguranca

As rotas `/embed/*` removem `X-Frame-Options` e usam `Content-Security-Policy` com `frame-ancestors` calculado pela allowlist. Rotas normais e administrativas continuam protegidas contra iframe; `/admin/*` usa `frame-ancestors 'none'`.

O script de autoaltura aceita somente mensagens `fioreze:embed:ready` e `fioreze:embed:resize`, valida `event.origin` contra o `src` do iframe e nao aceita comandos arbitrarios.

## Troubleshooting

- Dominio nao autorizado: confira se a origem cadastrada e exatamente `https://dominio`, sem path.
- Modulo desabilitado: habilite o modulo publico para a unidade antes de liberar embed.
- Conteudo nao aparece no site: confirme CSP do site hospedeiro e se o iframe aponta para `/embed/<hotel>/<module>/`.
- Altura fixa cortando conteudo: use o snippet com `/embed/fioreze-embed.js`.
- Admin em iframe: nao e suportado nem permitido.

## Limites do MVP

O primeiro modulo visual incorporado e o Room Service em modo catalogo. Acoes sensiveis continuam validadas pelo Worker e o portal completo permanece como caminho principal para fluxos transacionais.
