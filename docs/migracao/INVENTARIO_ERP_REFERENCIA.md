# Inventario do ERP Room Service de Referencia

Arquivo analisado: `sistema gestao de pedidos erp .html`

Este documento registra somente estrutura, comportamentos e decisoes de migracao. Valores sensiveis, endpoints, codigos antigos, usuarios, senhas, dados pessoais e URLs completas foram omitidos.

## Resumo

- HTML unico minificado com aproximadamente 291 KB.
- Aplicacao visualmente rica, com sidebar, topbar, login, dashboard, PDV, pedidos, hospedes, faturamento, cardapio e administracao.
- Contem CSS e JavaScript inline em grande volume.
- Usa dependencias externas por CDN e fontes remotas.
- Usa integracao legada por webhook/Apps Script e referencias a planilhas.
- Possui cache local amplo e funcoes de administracao antigas.
- Inclui referencias a imagens externas e logos fora do ecossistema novo.

## Recursos Inventariados

| Recurso | Observacao | Classificacao |
| --- | --- | --- |
| Login visual | Tela centralizada, logo, campos e loader proprio. | Preservar visualmente e migrar autenticacao para API atual |
| Sidebar clara | Layout recolhivel, logo horizontal e selo compacto. | Preservar visualmente |
| Topbar | Unidade, status da loja, busca, notificacoes e conta. | Preservar visualmente e migrar dados para D1 |
| Dashboard | Cards, metricas, graficos e resumo operacional. | Preservar visualmente e migrar calculos para Worker/D1 |
| PDV Direto | Produtos, categorias, carrinho e criacao manual. | Preservar funcionalmente em fase futura |
| Pedidos | Lista, filtros, detalhes, status e historico. | Preservar funcionalmente usando `orders` e `order_status_history` |
| Hospedes | Area visual existente. | Adiar integracao PMS; usar estado vazio seguro |
| Faturamento | Relatorios e exportacao. | Migrar para agregacoes D1; exportar sem CDN |
| Editor de Cardapio | Categorias, produtos, combos, disponibilidade e imagens. | Migrar para catalogos e Biblioteca de Imagens |
| Administracao antiga | Usuarios e permissoes do legado. | Remover como fluxo legado; usar admin oficial atual |
| Ajuda contextual | Drawer, dicas e orientacoes. | Preservar conteudo nao sensivel |
| Changelog | Estrutura de versoes e novidades. | Manter estatico no frontend |
| Notificacoes | Sino/topbar e mensagens. | Preservar visualmente; implementar dados por API futura |
| Tema claro/escuro | Alternancia visual. | Preservar em storage seguro |
| Escala/modo compacto | Preferencias visuais. | Preservar em storage seguro |
| Status da loja | Indicador operacional. | Migrar para configuracao por hotel |
| Modais/toasts/loaders | Componentes de feedback. | Preservar visualmente |
| Graficos | Dependencia Chart.js por CDN. | Remover CDN; preferir SVG/CSS ou dependencia local justificada |
| Exportacao XLSX | Dependencia XLSX por CDN. | Remover CDN; avaliar CSV ou dependencia local |
| Atalhos de teclado | Busca, logout e confirmacoes. | Preservar quando seguro |
| Controles Electron | Previsto no legado. | Adiar para PR Electron com preload restrito |
| Cache local | Armazena dados operacionais no legado. | Substituir por storage versionado e nao sensivel |
| Webhook/Apps Script | Integracao principal antiga. | Remover por ser legado |
| Google Sheets | Fonte operacional antiga. | Remover por ser legado |
| Impressao | Funcoes antigas acopladas ao fluxo. | Adiar; manter `IMPRESSION_ENABLED=false` |
| Imagens externas | Logos/produtos/decorativas fora do R2. | Migrar para R2/media_assets; nao copiar URLs |

## Dados Estaticos Preservaveis

- Nomes das secoes principais.
- Rotulos de status.
- Estrutura de ajuda.
- Estrutura de changelog.
- Mensagens vazias e de erro.
- Opcoes de tema, escala e modo compacto.
- Linguagem de PDV e faturamento.
- Padrao visual de cards, filtros e modais.

## Dados Nao Preservados

- Usuarios e codigos antigos.
- Senhas ou qualquer segredo.
- Pedidos e hospedes reais.
- Telefones, quartos ocupados e observacoes reais.
- Produtos e precos antigos quando o catalogo novo ja e a fonte.
- URLs externas completas.
- Webhook e parametros de Apps Script.
- Dados de impressao processados.

## Decisao do PR 1

O PR 1 cria apenas a fundacao oficial:

- Central Administrativa deixa de operar pedidos.
- `/erp/room-service/` passa a ser a rota canonica.
- `/admin/room-service/*` redireciona para `/erp/room-service/*`.
- O ERP ganha shell proprio, modular, sem CDN, sem webhook e sem dados operacionais estaticos.
- Funcionalidades completas de PDV, faturamento, cardapio e Electron ficam para PRs posteriores.
