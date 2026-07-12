# Design System Administrativo

## Inventario do Admin Legado

A Central Administrativa possuia tres shells visuais separados:

- `/admin/`: login, topbar, lista de sistemas e unidades autorizadas;
- `/admin/room-service/`: login, topbar, filtros, lista e detalhe de pedidos;
- `/admin/portais/`: login, sidebar propria, topbar, unidades, imagens e links.

Os elementos duplicados eram login, marca, sessao do usuario, logout, topbar, estados de carregamento, mensagens de erro e acesso negado. O PR de fundacao preserva as rotas e os modulos existentes, mas adiciona uma camada compartilhada em `admin-auth-view.js` para navegação, identidade, avatar, menu mobile e ajuda contextual.

## Identidade

Ainda nao ha um wordmark oficial Fioreze versionado para a Central. O shell usa um lockup textual provisorio com `FIOREZE` e um simbolo simples `F`. Esse fallback deve ser substituido por asset oficial quando a marca for fornecida.

## Tokens

- Fundo: claro, neutro, sem blur.
- Destaque: dourado Fioreze `#C2A94B`, usado em selecao, foco e estados de marca.
- Superficies: branco com borda discreta.
- Cantos: moderados, entre 14px e 24px.
- Sombras: suaves, apenas para separar planos.
- Icones: SVG inline locais, sem CDN.
- Movimento: curto e respeitando `prefers-reduced-motion`.

## Componentes Compartilhados

- Shell administrativo global;
- Sidebar desktop;
- Drawer mobile;
- Topbar moderna;
- Lockup Fioreze;
- Avatar por iniciais;
- Navegacao baseada em permissoes;
- Botao de ajuda;
- Drawer de ajuda contextual;
- Botoes de icone;
- Cards, listas e paineis existentes com acabamento unificado;
- Estados de carregamento, vazio, erro e acesso negado preservados.

## Linguagem

A interface principal deve preferir termos humanos:

- Hotel -> Unidade;
- Modulo -> Area;
- Slug -> Endereco personalizado;
- Asset -> Imagem;
- Permission denied -> Voce nao tem acesso a esta funcao.

IDs internos e chaves tecnicas devem ficar restritos a detalhes tecnicos ou suporte.

## Acessibilidade

O shell inclui foco visivel herdado do navegador, botoes com `aria-label`, area de ajuda com fechamento por `Esc`, drawer mobile sem depender de hover e touch targets de pelo menos 44px nos controles principais.

## Proximas Etapas

- PR 2: usuarios, perfis, permissoes, senhas e sessoes;
- PR 3: Minha conta, avatar privado em R2, dashboard final e polimento visual.

## Minha Conta

A area Minha conta usa os mesmos tokens visuais do shell e exibe avatar privado quando existir.
Sem foto, o fallback usa iniciais do nome em um bloco neutro, sem servico externo.
