# ERP Fioreze Design System

Esta documentacao descreve a nova fundacao visual do ERP Room Service. A camada operacional, as permissoes, os contratos de API e o isolamento por `hotel_id` permanecem nos modulos existentes.

## Principios

- branco e neutros claros formam a base da interface;
- a cor da unidade funciona como assinatura, sem dominar a tela;
- tipografia, alinhamento e espacamento organizam antes de bordas e cards;
- superfices existem somente quando separam uma tarefa real;
- movimento curto comunica mudanca de estado sem atrasar a operacao;
- controles essenciais permanecem acessiveis por teclado e toque.

## Arquivos

- `public/css/modules/room-service-erp/design-system-v5.css`: tokens, shell, componentes, telas, estados e responsividade;
- `public/js/modules/room-service-erp/theme.js`: normalizacao, contraste e derivacao das cores da unidade;
- `public/js/modules/room-service-erp/legacy-app.js`: composicao das telas e aplicacao do branding recebido pela API;
- `public/erp/room-service/index.html`: shell funcional unico do ERP.

`design-system-v5.css` deve permanecer como a ultima folha de estilo. Ela substitui visualmente as camadas historicas sem alterar IDs, eventos ou contratos usados pela operacao.

## Tokens

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

- superficies: `--erp-canvas`, `--erp-surface`, `--erp-surface-raised`, `--erp-surface-soft`;
- texto: `--erp-text`, `--erp-text-soft`, `--erp-text-muted`, `--erp-text-faint`;
- bordas: `--erp-line`, `--erp-line-strong`;
- estados: `--erp-success`, `--erp-warning`, `--erp-danger`, `--erp-info`;
- espacamento: `--erp-space-1` ate `--erp-space-12`;
- raio: `--erp-radius-xs` ate `--erp-radius-xl` e `--erp-radius-pill`;
- movimento: `--erp-motion-fast`, `--erp-motion-normal`, `--erp-motion-slow`;
- camadas: `--erp-z-sticky`, `--erp-z-dropdown`, `--erp-z-overlay`, `--erp-z-modal`, `--erp-z-toast`, `--erp-z-tooltip`.

## Branding e logos

`applyBranding()` recebe da API nome, cores, fonte e logos da unidade. `applyBrandTokens()` converte as cores em tokens derivados. As areas de marca usam `object-fit: contain`, dimensoes estaveis e fallback para manter logos horizontais, verticais ou transparentes dentro do layout.

Nao use cor de hotel diretamente em um novo seletor. Use um token `--brand-*`. Erro, alerta, sucesso e informacao usam sempre os tokens semanticos `--erp-*`.

## Padroes de pagina

Uma nova tela deve reutilizar:

1. `.erp-page` para o conteiner;
2. `.erp-page-header` para contexto, titulo, descricao e acoes;
3. `.erp-page-actions` para controles principais;
4. `.erp-list-section` ou `.erp-panel` somente quando houver separacao semantica;
5. estados vazios e loading locais, sem bloquear toda a aplicacao.

Tabelas e listas priorizam leitura e reduzem informacao secundaria em telas pequenas. Formularios usam labels acima dos campos e grids apenas quando os campos possuem relacao.

## Responsividade

- acima de 1180 px: shell completo, paineis operacionais lado a lado e PDV com comanda fixa;
- ate 1180 px: densidade adequada a notebooks;
- ate 900 px: menu em drawer e conteudo em uma coluna;
- ate 680 px: acoes empilhadas e modais como bottom sheets;
- ate 440 px: indicadores e controles em uma coluna.

## Movimento e acessibilidade

Transicoes usam duracoes entre 120 e 260 ms. Sidebar, menus, modais, toasts e controles compartilham curvas consistentes. Em `prefers-reduced-motion: reduce`, animacoes e transicoes nao essenciais sao reduzidas.

Todo controle deve manter foco visivel, `aria-label` quando usa somente icone, `aria-current` na navegacao e alvo de toque adequado. Tooltips complementam a sidebar recolhida sem esconder informacao necessaria.
