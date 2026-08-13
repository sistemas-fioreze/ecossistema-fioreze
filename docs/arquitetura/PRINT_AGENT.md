# Agente de impressao do Room Service

## Objetivo

Substituir a leitura de Google Sheets do sistema anterior por uma fila autenticada da plataforma, sem fazer o Worker depender de uma impressora local. Cada computador e vinculado a uma unidade e recebe somente pedidos do respectivo `hotel_id` e do modulo `room-service`.

## Componentes

- `PrintProvider`: inclui o trabalho na fila junto com a criacao do pedido.
- `print_events`: fila, tentativas, claim e resultado da impressao.
- `printer_devices`: computadores autorizados, impressora escolhida e template.
- `printer_enrollment_codes`: codigos de uso unico com validade de 15 minutos.
- `printer_templates`: modelos versionaveis por unidade.
- `app/print-agent`: aplicativo Windows empacotavel em EXE.

No primeiro acesso, o aplicativo reaproveita as impressoras instaladas no Windows para que o operador selecione a unidade e a impressora. Depois do vinculo, ele fica na bandeja com a logo reduzida publica da unidade. A impressora pode ser atualizada sem reinstalar o programa.

## Seguranca

- O codigo de conexao e armazenado somente como SHA-256 e expira rapidamente.
- O token do computador tem 256 bits, aparece uma vez e fica como hash no D1.
- No Windows, o token local e protegido com DPAPI para o usuario do sistema operacional.
- Claims condicionais impedem dois computadores de assumirem a mesma comanda.
- Todas as consultas do agente incluem `hotel_id` e `module_key` derivados do token.
- O agente nao abre servidor HTTP, nao usa planilha e nao aceita comandos de impressao da rede local.
- Erros enviados pelo agente sao limitados e nao incluem stack trace ou credenciais.
- Atualizacoes usam um feed HTTPS fixo servido pelo Worker a partir do R2 privado.
- O manifesto aceita somente executavel versionado, tamanho limitado e SHA-256 valido.
- O download depende de confirmacao do operador; nunca e iniciado silenciosamente.
- A instalacao substitui somente o executavel local depois que o processo atual encerra.
- Token, unidade, impressora e demais configuracoes permanecem fora dos artefatos OTA.

## Template inicial

`legacy-thermal-42` usa 42 colunas, codificacao CP850 e duas vias:

- via do estabelecimento;
- via do hospede, com campo de assinatura.

O conteudo vem do snapshot do pedido no D1. Nenhum arquivo, credencial, endpoint ou configuracao de impressora do legado foi copiado.

## Empacotamento e atualizacoes

O build Windows cria um unico `Fioreze-Suite.exe` com Python e dependencias, alem
do instalador Electron do ERP. Ele nao conecta impressora e nao inclui token ou
configuracao de unidade.

A saida oficial fica em `release/Fioreze-Suite-Windows/`. Os artefatos OTA do ERP
ficam em `release/Updater/`; os do agente ficam em
`release/Print-Agent-Updater/`. Os feeds sao independentes, permitindo atualizar
o wrapper Electron e o processo de impressao sem reinstalar manualmente a Suite.

## Ativacao por etapas

1. Aplicar a migration da fundacao.
2. Publicar API e ERP com `IMPRESSION_ENABLED=false`.
3. Baixar o EXE produzido pelo workflow.
4. Homologar uma impressora com pedido totalmente ficticio e autorizacao expressa.
5. Habilitar a unidade e, por ultimo, a flag global.

Enquanto a ultima etapa nao ocorrer, o sistema permanece incapaz de enviar trabalhos ao agente.
