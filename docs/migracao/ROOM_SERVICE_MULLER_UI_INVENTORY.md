# Inventario tecnico da UI Room Service Muller

Data: 2026-07-05

Fonte historica sanitizada:

- `legacy/hoteis/muller-fioreze/room-service/pedidos/versao-atual/site pedidos.html`
- `legacy/hoteis/muller-fioreze/room-service/assets/logo.png`
- `legacy/hoteis/muller-fioreze/room-service/assets/logo ff.png`
- `legacy/hoteis/muller-fioreze/room-service/dados-exemplo/pedidos-ficticios.json`
- `legacy/hoteis/muller-fioreze/room-service/dados-exemplo/PLANILHAS_PRODUCAO.md`

Nenhum arquivo de `legacy/` foi executado, editado, movido ou renomeado. O HTML legado possui endpoint sanitizado `APPS_SCRIPT_ENDPOINT_REMOVIDO`; ele foi lido como referencia estatica.

## Estrutura visual

O legado usa uma experiencia de aplicativo mobile-first com fundo branco, tipografia serifada, acento premium, cantos grandes e sombras suaves. A tela abre com loader centralizado, logotipo, titulo "Seja bem-vindo" e pontos animados. Depois mostra uma area principal em duas colunas no desktop e fluxo empilhado no mobile.

Comportamento visual a preservar:

- loader de boas-vindas;
- cabecalho compacto no mobile;
- introducao textual do Room Service;
- painel de identificacao e resumo do pedido;
- catalogo com busca e filtros horizontais;
- cards arredondados com destaque de preco e botao adicionar;
- feedback por toast;
- modal de alerta/sucesso;
- overlay de envio;
- animacoes leves de entrada, pulse e sucesso;
- safe-area lateral e inferior.

Codigo antigo descartado:

- Tailwind por CDN;
- handlers inline `onclick`;
- HTML inteiro monolitico;
- montagem de HTML com dados sem escape centralizado;
- chamadas diretas ao Apps Script.

## Hierarquia das telas

1. Loader inicial.
2. Tela aberta com:
   - cabecalho mobile;
   - texto institucional;
   - formulario/resumo do pedido;
   - busca e filtros;
   - catalogo por categorias.
3. Banner de servico fechado quando fora do horario.
4. Estado vazio para busca sem resultados.
5. Modal de mensagem/confirmacao.
6. Overlay de envio.
7. Visualizador de imagem.

Na nova plataforma, o shell compartilhado continua em `app/public/index.html`, e o modulo de Room Service deve renderizar a experiencia dentro de `app/public/js/modules/room-service/`.

## Cabecalho e identidade visual

O legado fixa o nome Muller & Fioreze, logo e cores. Na migracao, esses valores nao devem ser fixos no modulo. Devem vir do bootstrap:

- `bootstrap.name`;
- `bootstrap.short_name`;
- `bootstrap.branding.logo_url`;
- `bootstrap.branding.primary_color`;
- `bootstrap.branding.secondary_color`;
- `bootstrap.branding.accent_color`;
- `bootstrap.branding.font_family`.

Preservar: hierarquia visual, tom premium, logo em destaque e status do servico.

Reimplementar: aplicacao de cores com CSS Custom Properties.

## Categorias e navegacao

O legado agrupa itens por categoria e tambem usa filtros horizontais por tags. A nova API ja retorna categorias ordenadas em `GET /api/v1/public/hotels/:hotel_slug/room-service/products`.

Preservar:

- busca por nome, descricao e categoria;
- navegacao horizontal de categorias;
- destaque da categoria ativa;
- rolagem suave ate a categoria;
- estado sem resultados.

Fase futura:

- tags reais de produto quando o catalogo passar a fornecer esse campo.

## Cards de produtos

O card legado contem:

- selo de tipo/tag;
- nome;
- subtitulo ou meta;
- descricao;
- preco;
- imagem pequena opcional;
- botao adicionar;
- estado esgotado/indisponivel.

Reimplementar:

- `name`, `description`, `price_cents`, `currency`, `image_url`, `available`, `availability_label`;
- fallback visual quando nao houver imagem;
- `loading="lazy"`;
- texto alternativo derivado do nome enquanto o schema nao trouxer alt text especifico;
- botao desabilitado quando indisponivel.

Codigo antigo descartado:

- regras de estoque por `estoque <= 0`;
- grupos de opcoes embutidos em arrays vindos da planilha;
- precos em reais como `number` do navegador.

## Carrinho

O legado mantem carrinho em memoria, com:

- adicionar item;
- somar quantidade quando item ja existe;
- aumentar/diminuir;
- remover quando quantidade chega a zero;
- contador de itens;
- total visual;
- pulse no contador;
- estado de carrinho vazio.

Reimplementar:

- carrinho isolado por `hotel_id` e `module_key`;
- persistencia em `sessionStorage`;
- revalidacao contra catalogo atualizado;
- totais apenas informativos;
- Worker como fonte definitiva de preco e total.

## Formulario

Campos do legado:

- nome;
- celular/WhatsApp opcional;
- numero da acomodacao;
- observacao do pedido;
- local de consumo/entrega.

Contrato atual da API:

- `guest_name`;
- `room_code`;
- `notes`;
- `origin`;
- `items`.

Mapeamento proposto:

- nome -> `guest_name`;
- acomodacao -> `room_code`;
- observacao, local de entrega e contato opcional -> `notes`;
- origem -> `public-web`.

Nao reimplementar:

- sincronizacao de hospede via Apps Script;
- validacao fixa de quartos reais do legado;
- dados reais de hospede.

## Validacoes

Front-end:

- carrinho nao vazio;
- nome obrigatorio;
- acomodacao obrigatoria;
- item indisponivel nao adiciona;
- duplo toque bloqueado;
- erro de rede preserva carrinho;
- sucesso limpa carrinho.

Worker:

- idempotency key obrigatoria;
- hotel e modulo habilitado;
- acomodacao ativa no hotel;
- produto do hotel/modulo;
- disponibilidade;
- preco e total recalculados no D1;
- pedido atomico;
- impressao desativada;
- status de horario por `service_hours`.

## Horarios

O legado usa parametros antigos de planilha (`manual`, `status`, `autoStart`, `autoEnd`) e bloqueia `finalizeOrder` quando fechado.

Na nova plataforma:

- usar exclusivamente `service_hours`;
- considerar `timezone` do hotel;
- suportar multiplas faixas no mesmo dia;
- suportar horario atravessando meia-noite;
- atualizar estado no front-end sem reload;
- bloquear tambem no Worker;
- testes deterministivos devem injetar data/hora apenas em ambiente nao-producao.

Dependencia antiga eliminada:

- `room_service.hours`;
- Apps Script `store_status`;
- relogio local sem timezone do hotel.

## Loaders, mensagens e confirmacao

Preservar:

- loader de catalogo;
- toast de item adicionado;
- modal de alerta;
- overlay de envio;
- confirmacao com animacao leve;
- mensagens amigaveis.

Reimplementar:

- erro de API;
- erro 409 de divergencia;
- erro 422 de validacao/servico fechado;
- tentativa de retry usando a mesma Idempotency-Key;
- botao para voltar ao cardapio apos sucesso.

## Responsividade e safe-area

Pontos do legado:

- mobile first;
- safe-area lateral;
- desktop em duas colunas;
- painel de pedido sticky no desktop;
- cards em grid responsivo;
- busca e filtros horizontais sem scrollbar visivel.

Na nova UI:

- testar 320, 360, 375, 390, 430, 768 e 1366 px;
- evitar rolagem horizontal;
- manter area de toque minima;
- usar drawer/painel de carrinho acessivel no mobile;
- respeitar `prefers-reduced-motion`.

## Botao voltar e navegacao

O legado nao define fluxo especial de historico; usa overlays fechaveis e rolagem para topo. A nova versao deve:

- fechar carrinho/modal com Escape;
- manter links do shell compartilhado;
- nao quebrar rotas SPA;
- deixar o botao voltar do navegador retornar para rotas anteriores da plataforma.

## Dependencias antigas eliminadas

- Apps Script;
- Google Sheets;
- URLs antigas de imagem ou endpoint;
- Tailwind CDN;
- Google Fonts remoto;
- servidor de impressao;
- sincronizacao de hospede;
- regras fixas de planilha.

## Itens para fase futura

- importar produtos reais;
- importar precos reais;
- importar imagens privadas aprovadas;
- mapear quartos reais;
- opcoes/complementos de produto;
- telefone/WhatsApp em campo proprio no schema, se aprovado;
- local de entrega em campo proprio no schema, se aprovado;
- tags reais de catalogo;
- visualizador de imagem com assets definitivos;
- integracao futura com fila de impressao.
