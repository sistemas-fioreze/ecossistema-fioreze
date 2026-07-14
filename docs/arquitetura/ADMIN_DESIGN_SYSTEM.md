# Design System Administrativo

## Produtos Administrativos

O Ecossistema Fioreze possui dois produtos administrativos compartilhados:

- `/admin/`: Central Administrativa para unidades, portais, equipe e governanca;
- `/erp/room-service/`: ERP operacional do Room Service.

A Central e o ERP usam a mesma linguagem visual, mas mantem navegacao, usuarios e responsabilidades proprias. A rota antiga `/admin/room-service/*` permanece como redirecionamento de compatibilidade para o ERP oficial.

## Identidade

O shell usa o nome `FIOREZE`, superficies brancas, fundo neutro e a cor institucional marrom `#513B2D` como destaque. O simbolo textual `F` permanece como fallback ate a disponibilizacao do asset oficial da marca.

## Tokens

- Fundo neutro `#F7F5F2`;
- Superficie branca `#FFFFFF`;
- Destaque institucional `#513B2D`;
- Sucesso verde, atencao dourada e erro vermelho;
- Bordas discretas e cantos de ate 8px;
- Icones SVG locais, sem CDN;
- Movimento curto, respeitando `prefers-reduced-motion`.

## Componentes Compartilhados

- Shell administrativo global;
- Sidebar desktop e drawer mobile;
- Topbar compacta;
- Avatar e menu de sessao;
- Navegacao baseada em permissoes;
- Ajuda contextual;
- Dialogos de edicao;
- Tabelas responsivas, filtros e estados vazios;
- Estados de carregamento, erro e acesso negado.

## Modulos Ativos

A Central Administrativa oferece fluxos funcionais para:

- Unidades, identidade, configuracoes e incorporacao;
- Biblioteca de imagens;
- Links personalizados;
- Conteudos, paginas, secoes, eventos e informacoes;
- Areas habilitadas por unidade;
- Navegacao dos portais;
- Usuarios, senhas temporarias e sessoes;
- Perfis e permissoes;
- Auditoria administrativa;
- Minha conta e avatar.

## Linguagem

A interface principal prefere termos de operacao:

- Hotel -> Unidade;
- Modulo -> Area;
- Slug -> Endereco personalizado;
- Asset -> Imagem;
- Permission denied -> Voce nao tem acesso a esta funcao.

IDs internos e chaves tecnicas ficam restritos a campos de configuracao ou suporte.

## Acessibilidade

Os controles mantem foco visivel, rotulos, mensagens com regioes vivas, fechamento de dialogos por controles explicitos, drawer mobile independente de hover e alvos de toque adequados. A navegacao e as acoes continuam utilizaveis em desktop e mobile.

## Seguranca

As telas respeitam a sessao administrativa, as permissoes e as unidades autorizadas. Senhas temporarias sao exibidas uma unica vez, nunca entram em logs ou auditoria, e as operacoes de escrita usam a protecao administrativa de origem e cabecalho.
