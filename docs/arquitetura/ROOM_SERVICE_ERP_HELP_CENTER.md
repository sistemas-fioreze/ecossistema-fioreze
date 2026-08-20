# Central de Ajuda do ERP Room Service

## Objetivo

A Central de Ajuda ensina os fluxos existentes no ERP Room Service sem retirar o usuário da tela em que está trabalhando. A implementação pertence ao frontend compartilhado do ERP e, por isso, funciona no navegador, no Worker, no Pages e no aplicativo Electron.

## Mapa auditado

As áreas documentadas na primeira versão são:

- Visão geral: indicadores, gráficos, data e situação dos pedidos;
- PDV direto: entrega, acomodação, hóspede, observações, produtos, comanda e envio;
- Pedidos: período, lista, detalhes, status, cancelamento e reimpressão;
- Hóspedes: busca e diretório operacional da unidade;
- Faturamento: período, indicadores, gráficos, lista e CSV;
- Editor de cardápio: busca, categorias, produtos, disponibilidade, preço, imagem e exclusão;
- Funcionamento: modo automático ou manual e horário semanal;
- Acomodações: cadastro e disponibilidade de quartos;
- Impressão: configuração, vínculo, diagnóstico, teste, reinício e reimpressão;
- Usuários do ERP: código numérico, senha, status e permissões por módulo;
- Conta: foto, senha e encerramento da sessão;
- Aplicativo Electron: versões e atualização do Fioreze Suite.

Não foram incluídos módulos inexistentes no ERP atual, como estoque, pagamento ou fornecedores.

## Arquitetura

- `app/public/js/modules/room-service-erp/help-content.js`: categorias, artigos, metadados, passos, permissões, plataformas, relações e screenshots;
- `app/public/js/modules/room-service-erp/help.js`: busca, filtro de acesso, contexto da rota, navegação, histórico, foco e visualizador de imagem;
- `app/public/css/modules/room-service-erp/help-center.css`: layout, estados, responsividade e overlays de destaque;
- `app/public/assets/help/room-service-erp/`: capturas reais e sanitizadas do ERP;
- `app/tests/room-service-erp-help-center.test.js`: conteúdo, busca, permissões, plataformas, integração e assets.

O controlador recebe a rota, as permissões, a condição de administrador mestre e a plataforma diretamente do shell ativo. Nenhuma decisão de autorização depende apenas do estado visual da ajuda.

## Adicionar um artigo

1. Adicione um objeto a `HELP_ARTICLES` em `help-content.js`.
2. Use um `id` único, uma categoria existente, descrição, palavras-chave, rotas relacionadas, permissões e ao menos três passos completos.
3. Relacione outros artigos pelos respectivos IDs em `related`.
4. Quando o conteúdo for exclusivo do aplicativo, use `platforms: ["electron"]`. Conteúdo compartilhado usa o padrão web e Electron.
5. Execute os testes. O artigo entra automaticamente na categoria, pesquisa, ajuda contextual e relacionados.

## Capturas de tela

Capturas devem ser feitas na interface real, em proporção 16:9, sem nomes, contatos, pedidos ou outras informações pessoais. Salve JPEG otimizado em `app/public/assets/help/room-service-erp/` e referencie apenas o nome do arquivo no passo.

Os destaques são metadados percentuais (`x`, `y`, `width`, `height`, `label`) renderizados por HTML/CSS. A imagem original não deve receber setas, caixas ou textos permanentes. As imagens usam `loading="lazy"` e só são carregadas quando o artigo entra na interface.

## Compatibilidade

O ERP servido por Worker e Pages utiliza os mesmos arquivos estáticos e módulos ES. O Electron carrega a mesma interface e apenas acrescenta o artigo de atualização do aplicativo. Não existe uma cópia paralela da Central de Ajuda no desktop.

O painel respeita a barra de título Electron, mantém foco dentro do diálogo, fecha com Esc ou clique no fundo e devolve o foco ao acionador. A tela original e seu estado permanecem montados enquanto a ajuda está aberta.

## Limites da primeira versão

As capturas de Pedidos, Hóspedes, usuários e impressão não foram incluídas porque o ambiente disponível continha dados operacionais reais. Esses fluxos possuem instruções completas em texto e devem ganhar imagens somente após a preparação de uma sessão local com dados fictícios.
