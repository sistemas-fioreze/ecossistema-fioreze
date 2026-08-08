# ERP Fioreze Design System

Este documento descreve a camada visual compartilhada do ERP Room Service. A logica operacional, as permissoes, os contratos de API e o isolamento por `hotel_id` continuam sob responsabilidade dos modulos existentes.

## Principios

- branco e neutros claros formam a base da interface;
- o conteudo operacional permanece como protagonista;
- a identidade da unidade funciona como acento, nunca como cor semantica;
- espacamento e tipografia organizam a tela antes de bordas ou sombras;
- movimento curto comunica mudanca de estado sem atrasar a operacao;
- todos os elementos interativos devem permanecer acessiveis por teclado.

## Arquivos

- `public/css/modules/room-service-erp/design-system-v4.css`: tokens, shell, componentes, estados e responsividade;
- `public/js/modules/room-service-erp/theme.js`: normalizacao de cores, contraste e tokens derivados;
- `public/js/modules/room-service-erp/legacy-app.js`: composicao das telas e aplicacao do branding recebido pela API;
- `public/erp/room-service/index.html`: shell unico do ERP.

`design-system-v4.css` deve continuar sendo a ultima folha de estilo do ERP. Ela funciona como a camada de compatibilidade enquanto a marcacao historica ainda e utilizada pelas funcoes operacionais.

## Tokens

Os tokens globais usam os prefixos `--erp-` e `--brand-`.

### Marca da unidade

- `--brand-primary`
- `--brand-primary-hover`
- `--brand-primary-active`
- `--brand-primary-soft`
- `--brand-primary-subtle`
- `--brand-primary-border`
- `--brand-primary-text`
- `--brand-on-primary`
- `--brand-secondary`

As variacoes sao calculadas em `theme.js`. `--brand-on-primary` escolhe texto claro ou escuro conforme o contraste da cor cadastrada na Central.

### Estrutura

- superficies: `--erp-bg`, `--erp-surface`, `--erp-surface-muted`;
- texto: `--erp-text`, `--erp-text-secondary`, `--erp-text-muted`;
- bordas: `--erp-border`, `--erp-border-strong`;
- estados: `--erp-success`, `--erp-warning`, `--erp-danger`, `--erp-info`;
- espacamento: `--erp-space-1` ate `--erp-space-10`;
- raio: `--erp-radius-sm`, `--erp-radius-md`, `--erp-radius-lg`, `--erp-radius-pill`;
- movimento: `--erp-motion-fast`, `--erp-motion-normal`, `--erp-motion-slow`;
- camadas: `--erp-z-sticky`, `--erp-z-dropdown`, `--erp-z-overlay`, `--erp-z-modal`, `--erp-z-toast`, `--erp-z-tooltip`.

## Branding e logos

`applyBranding()` recebe da API o nome, a cor primaria, a cor secundaria, a fonte e as logos da unidade. `applyBrandTokens()` converte as cores em tokens derivados. As areas de marca usam `object-fit: contain`, dimensoes estaveis e fallback textual para preservar logos horizontais, verticais ou transparentes.

Nao use uma cor de hotel diretamente em um seletor novo. Use um token `--brand-*`. Erro, alerta, sucesso e informacao sempre usam os tokens semanticos `--erp-*`.

## Padroes de pagina

Uma tela nova deve reutilizar esta gramatica:

1. `.erp-v4-page` para o conteiner;
2. `.erp-v4-page-header` para contexto, titulo, descricao e acoes;
3. `.erp-v4-toolbar` para busca e filtros;
4. `.erp-v4-section` para uma secao que realmente precise de superficie;
5. estados de loading, vazio e erro existentes, sem bloquear a tela inteira.

Tabelas e listas devem priorizar leitura, manter cabecalho claro, usar hover sutil e reduzir colunas secundarias em telas pequenas. Formularios usam labels acima dos campos, foco visivel e grids somente quando os campos possuem relacao.

## Responsividade

- acima de 1180 px: shell completo e paineis operacionais lado a lado;
- ate 1180 px: densidade reduzida para notebooks;
- ate 900 px: sidebar compacta e paineis em uma coluna;
- ate 680 px: topbar e acoes empilhadas, modais em formato de bottom sheet;
- ate 440 px: KPIs e controles em uma coluna.

O PDV preserva o painel de comanda fixo em desktop e passa a um fluxo vertical em telas menores.

## Movimento e acessibilidade

Transicoes sao especificas por propriedade e usam duracoes entre 120 e 280 ms. Sidebar, dropdowns, botoes, modais, toasts e itens interativos compartilham as mesmas curvas. Em `prefers-reduced-motion: reduce`, animacoes e transicoes nao essenciais sao praticamente removidas.

Todos os controles precisam manter foco visivel, `aria-label` quando usam apenas icone, `aria-current` na navegacao e alvo de toque confortavel. Tooltips complementam os icones da sidebar recolhida, sem esconder informacao essencial.
