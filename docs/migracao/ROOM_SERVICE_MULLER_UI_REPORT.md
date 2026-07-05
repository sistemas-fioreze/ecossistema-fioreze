# Relatorio da migracao visual do Room Service Muller

Data: 2026-07-05
Branch: feature/migrate-muller-room-service-ui

## Escopo

Esta etapa migrou a experiencia visual e funcional do Room Service Muller para o modulo compartilhado da nova plataforma, usando apenas ambiente local. O sistema legado foi usado somente como referencia historica sanitizada.

Nao houve deploy, escrita no D1 remoto, seed remoto, acesso a Apps Script, Google Sheets, servidor de impressao, impressora ou producao.

## Inventario usado

O inventario tecnico previo esta em:

- docs/migracao/ROOM_SERVICE_MULLER_UI_INVENTORY.md

Foram preservados como referencia visual e funcional:

- loader com identidade do hotel;
- cabecalho com logo e status;
- apresentacao do Room Service;
- status aberto/fechado;
- horario do dia e proxima abertura;
- busca;
- filtros horizontais de categorias;
- cards de produtos com imagem ou fallback;
- preco, descricao e disponibilidade;
- carrinho com quantidade, subtotal e total;
- formulario do pedido;
- feedback de envio;
- modal de confirmacao;
- mensagens amigaveis;
- comportamento mobile-first;
- respeito a safe-area;
- bloqueio de pedido fora do horario.

## Comportamentos reimplementados

- O modulo passou a montar a tela a partir do bootstrap publico do hotel.
- Produtos e categorias continuam vindo da API atual.
- Branding, cores, logo, moeda, idioma e horarios vem dos dados do hotel.
- O carrinho usa `sessionStorage` isolado por `hotel_id` e `module_key`.
- O carrinho revalida itens contra o catalogo atual antes de renderizar.
- O cliente envia precos apenas como verificacao de conflito; o Worker continua recalculando o total.
- A Idempotency-Key e mantida durante a tentativa atual de envio.
- O Worker bloqueia pedidos fora de `service_hours` com data/hora de teste injetavel fora de producao.
- Produtos indisponiveis aparecem desabilitados e nao podem ser adicionados.
- O drawer/painel do carrinho fecha com Escape e preserva foco visivel.

## Codigo antigo descartado

Nao foi copiado o HTML legado inteiro. Tambem nao foram reutilizadas as dependencias antigas:

- Apps Script;
- Google Sheets;
- endpoint antigo;
- Tailwind via CDN do legado;
- fontes remotas do legado;
- links remotos de imagem do legado;
- logica inline do HTML legado;
- servidor Python de impressao;
- qualquer caminho de impressora.

## Arquivos principais alterados

- app/public/js/modules/room-service/index.js
- app/public/js/modules/room-service/cart.js
- app/public/js/modules/room-service/catalog.js
- app/public/js/modules/room-service/service-status.js
- app/public/css/modules/room-service/room-service.css
- app/public/js/core/app.js
- app/src/modules/room-service/orders.js
- app/src/modules/room-service/products.js
- app/src/modules/room-service/service-hours.js
- app/tests/api-public.test.js
- app/tests/helpers/worker.js
- app/tests/orders.test.js
- app/tests/room-service-ui.test.js
- docs/migracao/ROOM_SERVICE_MULLER_UI_INVENTORY.md
- docs/migracao/ROOM_SERVICE_MULLER_UI_REPORT.md

## Assets utilizados

- A logo sanitizada do Muller ja existente em `app/public/assets/hotels/muller-fioreze/logo.png`.
- Nenhum asset real novo foi importado.
- Nenhuma imagem remota do legado foi reutilizada.
- Aurora usa fallback visual gerado pelo proprio componente quando nao ha logo.

## Mudancas no front-end

- Interface mobile-first com aparencia de aplicativo.
- Cards e categorias renderizados a partir da API.
- Busca local por nome, descricao e categoria.
- Navegacao horizontal de categorias.
- Fallback visual para itens sem imagem.
- Mensagens de carregamento, erro, vazio, fechado e sucesso.
- Modal de confirmacao.
- Carrinho flutuante no mobile e painel lateral no desktop.
- CSS baseado em custom properties do branding.
- Dados vindos da API escapados via DOM APIs, sem `innerHTML` para conteudo dinamico sensivel.
- Caminhos de midia aceitos somente quando locais em `/assets/`.

## Mudancas na API e Worker

- A resposta de produtos inclui `image_alt`.
- O POST de pedido consulta `service_hours` e bloqueia fora do horario.
- A validacao de horario respeita timezone do hotel.
- O header de teste `x-fioreze-test-now` e aceito apenas fora de producao.
- A impressao permanece desativada e nao ha chamada a provider externo.

## Carrinho e formulario

- Chave de carrinho: `fioreze-cart:<hotel_id>:room-service`.
- Carrinhos de Muller e Aurora ficam separados.
- Itens removidos ou indisponiveis deixam de ser aceitos.
- Campos preservados: nome, celular/WhatsApp opcional, acomodacao, local de entrega e observacoes.
- O campo de local/observacoes e mapeado para `notes` no contrato atual, sem alterar schema.
- Falhas de envio preservam o carrinho.
- Sucesso limpa o carrinho e mostra identificador publico quando disponivel.

## Horarios

- O front-end usa somente `service_hours`.
- A tela mostra estado aberto/fechado, horario do dia e proxima abertura quando disponivel.
- O estado e reavaliado periodicamente sem recarregar a pagina.
- O Worker tambem bloqueia pedidos fora do horario.
- Testes cobrem horario fechado, segunda faixa no mesmo dia e faixa atravessando meia-noite.

## Testes adicionados ou ampliados

- Catalogo e agrupamento de categorias.
- Produto disponivel, indisponivel e arquivado.
- Carrinho vazio, adicionar, incrementar, diminuir, remover e total em centavos.
- Isolamento do carrinho por hotel.
- Revalidacao do carrinho ao trocar catalogo.
- Envio, duplo toque, erro 422, erro 409, erro de rede e sucesso no cliente.
- Conteudo escapado.
- Service hours aberto, fechado, multipla faixa, dia fechado e virada de meia-noite.
- Bloqueio de pedido fora do horario no Worker.
- Produtos com `image_alt`.

## QA visual local

Servidor usado:

- `npm run dev -- --port 8787`

Rotas testadas:

- `http://127.0.0.1:8787/muller-fioreze/room-service`
- `http://127.0.0.1:8787/aurora-demo/room-service`

Capturas temporarias, nao versionadas:

- `C:/Users/wesle/AppData/Local/Temp/fioreze-room-service-qa-20260705-150954`

Viewports capturados para Muller e Aurora:

- 320 x 800
- 360 x 800
- 375 x 844
- 390 x 844
- 430 x 932
- 768 x 1024
- 1366 x 768

Resultado visual:

- Müller carrega identidade, logo, cores, categorias e produtos proprios.
- Aurora carrega nome, cores, modulo e catalogo proprios.
- Nao houve overflow horizontal nos checks de DOM.
- O layout mobile manteve cabecalho, status, busca, categorias e carrinho fixo.
- O layout desktop manteve formulario e carrinho em painel lateral.
- Console do Chrome headless nao registrou erros nas rotas testadas.

## Regressao local

Rotas verificadas em ambiente local:

- `/api/v1/health`
- `/muller-fioreze`
- `/muller-fioreze/room-service`
- `/aurora-demo`
- `/aurora-demo/room-service`
- `/admin`
- `/admin/`
- `/api/v1/admin/session`
- bootstrap publico do Muller;
- produtos do Muller;
- criacao local de pedido ficticio;
- repeticao idempotente do mesmo pedido;
- Static Assets do modulo.

Resultado do pedido local ficticio:

- primeira tentativa: HTTP 201;
- repeticao com a mesma Idempotency-Key: HTTP 200;
- `idempotent`: true na repeticao;
- impressao: `enabled=false`.

## Limitacoes

- As capturas foram geradas por Chrome headless local. O pacote Playwright disponivel no runtime nao carregou `playwright-core`, entao o QA visual foi feito pelo fallback com Chrome/CDP.
- Os dados continuam ficticios de desenvolvimento.
- O formulario ainda mapeia local de entrega e observacoes para `notes`, pois nao houve alteracao de schema nesta tarefa.
- Produtos reais, precos reais, quartos reais, imagens privadas e historico real ficam para uma etapa futura autorizada.

## Itens futuros

- Importacao controlada de dados reais depois de aprovacao visual.
- Refinar contrato de pedido se o modelo final exigir campos separados para telefone e local de entrega.
- Definir assets finais por hotel.
- Integrar impressao futura por provider desacoplado, mantendo `IMPRESSION_ENABLED=false` enquanto nao autorizado.
- Expandir o ERP para operar o novo fluxo de pedidos.
