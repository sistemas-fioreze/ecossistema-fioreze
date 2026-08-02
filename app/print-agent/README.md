# Agente de impressao Fioreze

Aplicativo Windows que recebe, pela API autenticada da plataforma, somente os pedidos da unidade vinculada e os envia para a impressora configurada. Ele substitui a leitura de Google Sheets e nao inicia servidor HTTP local.

## Primeiro acesso

1. No ERP da unidade, abra `Configuracoes > Impressao` e gere um codigo de conexao.
2. Abra `Fioreze-Impressao.exe`.
3. Escolha a unidade, informe o codigo, nomeie o computador e selecione a impressora.
4. O token retornado uma unica vez pela API e protegido com DPAPI no perfil do Windows.

Depois da conexao, o aplicativo permanece na bandeja do Windows usando a logo reduzida da unidade selecionada. O menu da bandeja permite reabrir ou encerrar o agente. A tela principal tambem permite atualizar a lista de impressoras e trocar a impressora escolhida sem reinstalar o programa.

O codigo expira em 15 minutos e so pode ser usado uma vez. O computador pode ser pausado ou revogado no ERP.

## Fluxo

- O Worker grava um `print_event` na mesma operacao do pedido quando a impressao global e a da unidade estiverem habilitadas.
- O agente faz polling por HTTPS e assume um trabalho por tempo limitado.
- O agente renderiza o template selecionado e envia bytes RAW para a impressora Windows.
- A confirmacao atualiza o evento e registra o status `printed` uma unica vez.
- Um diario local registra o ID logo apos o spooler aceitar a comanda; se a confirmacao HTTPS falhar, o agente sincroniza o mesmo trabalho sem imprimir novamente.
- Pedidos agendados ficam na fila ate o horario definido.

O template inicial `legacy-thermal-42` preserva a estrutura funcional do comprovante antigo: 42 colunas, via do estabelecimento e via do hospede. Nenhum dado, credencial ou caminho de impressora do sistema legado foi copiado.

## Desenvolvimento seguro

```bash
cd app/print-agent
PYTHONPATH=. python3 -m unittest discover -s tests -v
```

Os testes apenas renderizam bytes em memoria. Eles nunca chamam uma impressora.

## Gerar o EXE

Em Windows com Python 3.12 instalado para o processo de build:

```powershell
powershell -ExecutionPolicy Bypass -File .\build-windows.ps1
```

O build cria `release/Fioreze-Impressao-Windows/` com o executavel, instrucoes, versao e checksum, alem de `release/Fioreze-Impressao-Windows.zip`. O executavel inclui o interpretador e as dependencias; o computador da recepcao nao precisa instalar Python. O pipeline GitHub Actions produz o mesmo ZIP em ambiente Windows.

O pacote de distribuicao nunca inclui `config.json`, token, nome de impressora ou outro estado do computador. Esses dados sao criados apenas depois da ativacao, em `%LOCALAPPDATA%\Fioreze\PrintAgent`.

## Ativacao operacional

O software pode ser publicado com `IMPRESSION_ENABLED=false`. Habilitar uma impressora real exige, em etapa separada, validar o modelo, papel, codificacao, corte, rede local e uma comanda ficticia autorizada.
