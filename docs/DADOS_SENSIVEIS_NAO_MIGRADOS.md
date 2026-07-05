# Dados Sensiveis Nao Migrados

Os seguintes arquivos reais da entrada nao foram copiados para a estrutura organizada:

- `server de impressao/credenciais.json`: credencial Google service account e chave privada.
- `server de impressao/config.json`: ID real de planilha e caminho real de impressora.
- `server de impressao/status.json`: estado operacional real.
- `server de impressao/logs_impressao.txt`: logs com dados operacionais.
- `server de impressao/historico_14-06-2026.txt`: historico real de cupons/pedidos.
- `server de impressao/contador.txt`: contador real de comandas.
- `server de impressao/ultima_linha.txt`: estado local real.
- `server de impressao/__pycache__/`: cache Python.

Tambem nao foi copiado `Link Planilhas.txt`, pois contem links reais de producao.

As copias de HTML, Apps Script e Python foram sanitizadas com placeholders.
