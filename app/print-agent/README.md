# Fioreze Suite para Windows

Aplicativo unico para preparar o computador da unidade, instalar o ERP desktop identificado e, opcionalmente, instalar o agente de impressao automatica. O pacote inclui Electron, Python e suas dependencias; a recepcao nao precisa instalar componentes manualmente.

## Instalacao

1. Abra `Fioreze-Suite.exe`.
2. Escolha a unidade carregada da plataforma.
3. Mantenha selecionado `Criar atalhos do ERP desta unidade`.
4. Para usar impressao, marque `Instalar agente de impressao automatica`, gere um codigo em `ERP > Configuracoes > Impressao` e informe-o no instalador.
5. Escolha a impressora Windows e conclua.

O codigo expira em 15 minutos e funciona uma unica vez. O instalador nunca pede a senha administrativa: o vinculo usa o codigo descartavel e recebe um token exclusivo do computador. Esse token e protegido com DPAPI no perfil do Windows.

O atalho abre o `Fioreze-ERP.exe`, que usa a rota da unidade `/<slug>/admin/erp/` e o icone reduzido configurado na Central. Como o aplicativo carrega a versao web oficial, as mudancas publicadas no ERP aparecem sem reinstalacao. O agente instalado inicia com o Windows e permanece na bandeja com o mesmo icone.

## Operacao

Na janela redesenhada e no menu da bandeja, o operador pode:

- testar a conexao HTTPS com a plataforma;
- atualizar a lista de impressoras;
- escolher uma impressora;
- escolher um dos templates liberados para a unidade;
- enviar uma pagina de teste, sempre depois de confirmacao explicita;
- abrir o ERP da unidade.

O gerenciador apresenta estado de conexao, unidade, computador, impressora,
versao e atividade recente em um painel vertical compacto. Ao abrir pelo icone,
a janela de tamanho fixo e posicionada junto a bandeja do Windows e retorna para
a bandeja pelo botao de fechar. O ERP Electron tambem mostra o
estado local da impressao em sua barra de titulo branca e abre esta janela sem
iniciar uma segunda instancia do agente.

O ERP mostra o computador como online quando recebeu contato nos ultimos dois minutos. Tambem mostra versao, impressora, template, ultimo contato e permite pausar ou revogar o dispositivo.

No aplicativo desktop, o ERP tambem consulta o estado local e pode solicitar o reinicio do agente.
O estado e gravado em `%LOCALAPPDATA%\Fioreze\PrintAgent\runtime-status.json` sem token,
senha ou credencial. Os pedidos locais `show.request` e `restart.request` permitem
mostrar ou reiniciar o processo existente. Nenhuma porta HTTP local e aberta.

## Templates

- `legacy-thermal-42`: comprovante termico generico, com duas vias.
- `legacy-centro-elgin-48`: layout do Fioreze Centro para impressora Elgin de 48 colunas, com via cozinha/recepcao, via do hospede, valores unitarios e totais.

O renderer usa os itens estruturados recebidos pela API. Nenhum ID de planilha, endpoint antigo, credencial ou nome fixo de impressora faz parte do pacote.

## Seguranca

- A API entrega apenas trabalhos do `hotel_id` vinculado ao token.
- Impressora e template sao validados e persistidos para o mesmo hotel.
- O diario local evita reimpressao se a confirmacao HTTPS falhar.
- O teste de impressao nao cria pedido nem `print_event`.
- O pacote de distribuicao nao inclui `config.json`, token ou estado operacional.

## Testes

```powershell
cd app/print-agent
$env:PYTHONPATH = "."
python -m unittest discover -s tests -v
```

Os testes renderizam bytes em memoria e usam pastas temporarias. Eles nunca chamam impressora real.

## Build

```powershell
powershell -ExecutionPolicy Bypass -File .\build-windows.ps1
```

O build gera `release/Fioreze-Suite-Windows/` e `release/Fioreze-Suite-Windows.zip`, com `Fioreze-Suite.exe`, a pasta `Fioreze-ERP/`, instrucoes, versao e checksums SHA-256.
