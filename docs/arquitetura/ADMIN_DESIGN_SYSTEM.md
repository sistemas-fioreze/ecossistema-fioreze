# Design System Administrativo

## Produtos Administrativos

O Ecossistema Fioreze possui dois produtos administrativos compartilhados:

- `/admin/`: Central Administrativa para unidades, portais, equipe e governanca;
- `/erp/room-service/`: ERP operacional do Room Service.

A Central e o ERP usam a mesma linguagem visual, mas mantem navegacao, usuarios e responsabilidades proprias. A rota antiga `/admin/room-service/*` permanece como redirecionamento de compatibilidade para o ERP oficial.

## Identidade

O shell usa a marca oficial FIOREZE em `/assets/shared/fioreze-central-logo.jpg`, superficies brancas e fundo neutro. O arquivo e uma copia versionada e sanitizada da midia de desenvolvimento aprovada `media_7449a1c9-2575-447d-a782-7b206b186985`. A URL relativa preserva a identidade no Worker local e publicado sem depender de CDN, sessao ou registro D1.

A cor institucional permanece como paleta inicial. O menu da sessao permite que cada usuario escolha uma paleta propria entre `fioreze`, `terracotta`, `forest`, `ocean` e `graphite`. A escolha fica vinculada ao `admin_users.id` no D1, e nao ao navegador ou a unidade selecionada.

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
- Seletor pessoal de paleta;
- Marca estatica no login e carregamento moderno;
- Atualizacao manual por tela com carregamento limitado a area de conteudo;
- Areas de conteudo com rolagem vertical independente do shell;
- Tabelas responsivas, filtros e estados vazios;
- Estados de carregamento, erro e acesso negado.

## Modulos Ativos

A Central Administrativa oferece fluxos funcionais para:

- Unidades, identidade, configuracoes e incorporacao;
- Biblioteca de midia com imagens, videos, pastas e indicador de armazenamento;
- Links personalizados;
- Conteudos, paginas, secoes, eventos e informacoes;
- Areas habilitadas por unidade;
- Navegacao dos portais;
- Usuarios, senhas temporarias e sessoes;
- Perfis e permissoes;
- Auditoria administrativa;
- Minha conta e avatar.

Usuarios podem ser removidos sem apagar o historico: a conta e arquivada, as sessoes sao revogadas e os vinculos ativos sao encerrados. Perfis sem usuarios podem ser excluidos, enquanto perfis administrativos protegidos permanecem bloqueados contra remocao.

## Linguagem

A interface principal prefere termos de operacao:

- Hotel -> Unidade;
- Modulo -> Area;
- Slug -> Endereco personalizado;
- Asset -> Arquivo ou midia;
- Permission denied -> Voce nao tem acesso a esta funcao.

IDs internos e chaves tecnicas ficam restritos a campos de configuracao ou suporte.

## Acessibilidade

Os controles mantem foco visivel, rotulos, mensagens com regioes vivas, fechamento de dialogos por controles explicitos, drawer mobile independente de hover e alvos de toque adequados. A navegacao e as acoes continuam utilizaveis em desktop e mobile.

## Seguranca

As telas respeitam a sessao administrativa, as permissoes e as unidades autorizadas. Senhas temporarias sao exibidas uma unica vez, nunca entram em logs ou auditoria, e as operacoes de escrita usam a protecao administrativa de origem e cabecalho.

A Biblioteca de Midia aplica o mesmo isolamento por unidade a pastas, subpastas, imagens e videos. Mover um item modifica apenas sua organizacao administrativa e nao altera a URL publica nem o objeto salvo no R2.
