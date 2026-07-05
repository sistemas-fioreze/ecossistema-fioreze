# Inventario Muller & Fioreze

Fonte oficial de entrada: `Migração Arquivos Room service muller/`.

Esta pasta de entrada nao foi movida, editada, renomeada, sanitizada ou excluida.

| Arquivo de origem | Funcao provavel | Destino organizado | Dependencias | URLs externas |
| --- | --- | --- | --- | --- |
| `Appscript.gs` | Backend Apps Script atual | `legacy/hoteis/muller-fioreze/room-service/backend-appscript/versao-atual/` | Google Apps Script, Google Sheets | nenhuma URL direta |
| `site pedidos.html` | Tela publica de pedidos do hospede | `legacy/hoteis/muller-fioreze/room-service/pedidos/versao-atual/` | Tailwind CDN, Apps Script | Tailwind, Google Fonts, Postimg, Apps Script removido |
| `sistema gestão de pedidos.html` | ERP/painel interno | `legacy/hoteis/muller-fioreze/room-service/erp/versao-atual/` | Tailwind, Chart.js, xlsx, Apps Script, API local de impressao | CDNs, assets externos, Apps Script removido, localhost |
| `Link Planilhas.txt` | Links reais das planilhas de producao | nao copiado | Google Sheets | nao copiado por conter URLs reais |
| `server de impressao/server.pyw` | Servidor de impressao principal | `legacy/hoteis/muller-fioreze/room-service/impressao/versao-atual/` | Python, gspread, pywin32, Flask, pystray, Pillow | APIs Google removidas/sanitizadas |
| `server de impressao/server.py` | Servidor de impressao anterior com Tkinter | `legacy/hoteis/muller-fioreze/room-service/impressao/versoes-anteriores/` | Python, gspread, pywin32, Pillow | APIs Google removidas/sanitizadas |
| `server de impressao/appsscriptSIS.txt` | Apps Script anterior | `legacy/hoteis/muller-fioreze/room-service/backend-appscript/versoes-anteriores/` | Google Apps Script, Google Sheets | nenhuma URL direta |
| `server de impressao/requirements.txt` | Dependencias Python | `legacy/hoteis/muller-fioreze/room-service/impressao/` | Python packages | nenhuma |
| `server de impressao/package.json` | Dependencias/build Electron | `legacy/hoteis/muller-fioreze/room-service/impressao/` | Node, Electron | nenhuma |
| `server de impressao/package-lock.json` | Lockfile Node | `legacy/hoteis/muller-fioreze/room-service/impressao/` | npm registry | muitas URLs de registry |
| `server de impressao/iniciar_servidor_impressao.bat` | Inicializador Windows | `legacy/hoteis/muller-fioreze/room-service/impressao/` | Python local | nenhuma |
| `server de impressao/logo.png` | Asset de logo | `legacy/hoteis/muller-fioreze/room-service/assets/` | Pillow/ESC-POS | nenhuma |
| `server de impressao/logo ff.png` | Asset de logo | `legacy/hoteis/muller-fioreze/room-service/assets/` | Pillow/ESC-POS | nenhuma |
| `server de impressao/credenciais.json` | Credencial real Google | nao copiado | Google service account | nao copiado |
| `server de impressao/config.json` | Config real local | substituido por `config.example.json` | impressora, planilha | nao copiado |
| `server de impressao/status.json` | Estado real local | substituido por `status.example.json` | impressao local | nao copiado |
| `server de impressao/logs_impressao.txt` | Logs reais | nao copiado | impressao local | nao copiado |
| `server de impressao/historico_14-06-2026.txt` | Historico real de cupons | nao copiado | impressao local | nao copiado |
| `server de impressao/contador.txt` | Contador real | substituido por `contador.example.txt` | impressao local | nao copiado |
| `server de impressao/ultima_linha.txt` | Estado real legado | substituido por `ultima_linha.example.txt` | impressao local | nao copiado |
| `server de impressao/__pycache__/server.cpython-312.pyc` | Cache Python gerado | nao copiado | Python | nao copiado |

## Itens ausentes ou ambiguos

- A pasta `/entrada-muller` mencionada inicialmente nao existe na branch inspecionada.
- A pasta real usada como fonte e `Migração Arquivos Room service muller/`.
- `package.json` e `package-lock.json` indicam tentativa de empacotamento Electron, mas nao ha fonte Electron completa alem desses arquivos.
