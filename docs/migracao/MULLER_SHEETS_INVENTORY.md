# Inventario das planilhas do Room Service Muller

Data da analise: 2026-07-05

Escopo: leitura local dos arquivos fornecidos. Nenhuma planilha remota foi acessada, nenhum Apps Script foi executado e nenhum dado foi importado para D1.

## Arquivos analisados

| Arquivo | Tipo | Tamanho | Observacoes de seguranca |
| --- | --- | ---: | --- |
| Cardapio Room Service Muller Fioreze.xlsx | XLSX | 11.919 bytes | Contem catalogo, links de imagem e validacao de dados. Sem dado pessoal detectado. |
| Sistema Room Service Muller Fioreze.xlsx | XLSX | 50.396 bytes | Contem pedidos, usuarios, hospedes, parametros e historico. Possui dados pessoais e campo de senha. |
| Link Planilhas.txt | TXT | 240 bytes | Contem links de planilhas. URLs e IDs reais nao foram copiados. |
| Appscript.gs | Apps Script | 24.916 bytes | Contem regras atuais e logica de senha. Valores sensiveis nao foram reproduzidos. |
| sistema gestao de pedidos erp .html | HTML | 290.724 bytes | Contem referencias a endpoint Apps Script, assets externos e servidor local de impressao. Valores completos foram redigidos. |
| site pedidos.html | HTML | 40.800 bytes | Contem referencias a endpoint Apps Script e assets externos. Valores completos foram redigidos. |

## Abas encontradas

### Cardapio Room Service Muller Fioreze.xlsx

| Aba | Classe | Linhas | Linhas uteis | Colunas | Formulas | Validacoes | Links | Dados sensiveis |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Cardapio | produto | 81 | 78 | 11 | 0 | 1 | 10 | Nenhum detectado |

Cabecalhos:

- Categoria
- Nome do Prato
- Medida
- Descricao
- Preco
- Link da Imagem
- Opcoes
- Estoque
- Tag
- Coluna 1
- Coluna 2

Finalidade aparente: catalogo do Room Service. A aba contem categoria, produto, descricao, preco, imagem, opcoes, estoque e campos extras que hoje alimentam a experiencia do hospede e o ERP legado.

Observacoes:

- Catalogo unico identificado.
- Nao ha formulas detectadas.
- Ha links de imagem.
- Ha uma validacao de dados.
- Nao ha coluna explicita de `hotel_id` ou `module_key`; a migracao deve fixar `muller-fioreze` e `room-service`.
- Produtos vazios nao foram detectados na parte util.

### Sistema Room Service Muller Fioreze.xlsx

| Aba | Classe | Linhas | Linhas uteis | Colunas | Formulas | Validacoes | Links | Dados sensiveis |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Pedidos | pedidos | 161 | 160 | 10 | 0 | 2 | 0 | Dados pessoais de hospedes e acomodacao |
| Usuarios | configuracao | 6 | 5 | 12 | 0 | 1 | 0 | Senha e nomes de usuarios |
| Hospedes | historico | 39 | 38 | 6 | 0 | 2 | 0 | Nome, telefone, CPF, e-mail e acomodacao |
| Chat | historico | 1 | 0 | 5 | 0 | 0 | 0 | Campo de acomodacao; sem linhas de dados uteis |
| Parametros | horario | 2 | 1 | 4 | 0 | 0 | 0 | Possivel falso positivo numerico em horario |
| Codigo | configuracao | 11 | 1 | 2 | 0 | 0 | 0 | Endpoint Apps Script ou codigo HTML legado |
| Changelog | desconhecida | 5 | 4 | 3 | 0 | 0 | 0 | Nenhum detectado |

#### Aba Pedidos

Cabecalhos:

- Data/Hora
- Hospede
- Quarto
- Pedido
- Total
- Status Impressao
- Local de Consumo
- Atendente
- Status pedido
- Observacao

Finalidade aparente: historico operacional de pedidos e status de impressao/pedido.

Relacoes aparentes:

- `Pedido` parece conter o resumo dos itens em formato legado.
- `Quarto`, `Hospede` e `Observacao` sao dados pessoais/operacionais e nao devem entrar em fixtures.
- `Status Impressao` se relaciona ao servidor de impressao antigo.
- `Status pedido` precisa de normalizacao para o enum novo.

#### Aba Usuarios

Cabecalhos:

- Codigo
- Nome
- Senha
- Nivel
- Tema
- Status
- Trocar Senha
- Notificacoes
- Escala da interface
- Permissoes do usuario
- Mostrou changelog
- Log

Finalidade aparente: usuarios administrativos do ERP legado, preferencias, permissoes e log local.

Observacoes:

- Nao importar senhas ou hashes legados.
- Recriar usuarios administrativos futuramente com estrategia de autenticacao nova.
- Permissoes precisam ser mapeadas para `admin_roles`, `admin_permissions` e `admin_hotel_access`.

#### Aba Hospedes

Cabecalhos:

- Data Cadastro
- Nome
- Celular
- Ultimo Apto
- CPF
- E-mail

Finalidade aparente: cadastro/cache local de hospedes usado pelo ERP e pelo fluxo antigo.

Classificacao: Grupo B ou C, dependendo da finalidade futura. Nao importar para D1 de desenvolvimento com valores reais.

#### Aba Chat

Cabecalhos:

- Data/Hora
- Quarto
- Remetente
- Mensagem
- Atendente

Finalidade aparente: chat operacional legado entre hospede e atendimento. Nao havia linhas de dados uteis no arquivo analisado.

#### Aba Parametros

Cabecalhos:

- Abertura Manual
- Status
- Abertura
- Fechamento

Finalidade aparente: controle de funcionamento do Room Service no legado.

Destino provavel: `service_hours` e/ou `hotel_settings`, apos decisao sobre funcionamento manual.

#### Aba Codigo

Cabecalhos:

- Codigo Site Pedidos
- Codigo PDV Interno

Finalidade aparente: armazenamento de HTML/codigo legado dentro da planilha para entrega via Apps Script.

Classificacao: nao migrar como dado operacional. O codigo novo deve viver no repositorio e em Static Assets.

#### Aba Changelog

Cabecalhos:

- Data
- Versao
- Log

Finalidade aparente: historico de alteracoes do sistema legado/ERP.

Pode ser preservado como documentacao historica sanitizada, mas nao como dado funcional do Room Service.

## Itens ambiguos ou pendentes

- `Medida`, `Opcoes`, `Tag`, `Tipo/Coluna 1` e `Combo/Coluna 2` precisam de decisao: podem ficar em `catalog_items.metadata_json` ou virar campos de schema futuro.
- O campo `Pedido` na aba Pedidos precisa de parser especifico para quebrar itens, quantidades e snapshots.
- `Status pedido` e `Status Impressao` precisam de tabela de equivalencia antes de importar historico.
- Os links de imagem precisam de autorizacao antes de download ou migracao para R2/Static Assets.
- A aba `Usuarios` nao deve ser usada para migrar senhas.
