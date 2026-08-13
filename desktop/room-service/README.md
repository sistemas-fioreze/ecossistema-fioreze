# ERP Room Service Desktop

Wrapper Electron fino para abrir o ERP Room Service oficial em `/<slug-da-unidade>/admin/erp/`.

## Papel do pacote

- Nao duplica HTML, CSS, JavaScript ou backend do ERP.
- Nao acessa D1, R2, Apps Script, Google Sheets ou impressora diretamente.
- Nao embute credenciais, tokens ou senhas.
- Usa a sessao administrativa controlada pelo Worker.
- Usa a Window Controls Overlay oficial do Electron para preservar os controles
  nativos, Snap Layouts, Alt + Space, redimensionamento e DPI do Windows.
- Titlebar e sidebar usam uma superficie cinza clara, solida e identica em
  todas as versoes do Windows, sem Mica, Acrylic, blur ou transparencia.
- Mantem atualizar e estado da impressao na titlebar integrada ao Windows.
- Carrega a URL oficial da unidade; alteracoes publicadas aparecem sem reinstalar o aplicativo.
- Consulta e reinicia o Fioreze Print Agent por um canal local restrito.
- Captura a propria janela por uma API nativa do Electron ao enviar feedback.
- Verifica atualizacoes nativas sem download automatico e pede confirmacao.

## Desenvolvimento local

1. Inicie o Worker local em `app/`:

```bash
npm run dev -- --port 8787
```

2. Em outro terminal, dentro de `desktop/room-service/`:

```bash
npm ci
npm start
```

Em desenvolvimento, configure:

```text
FIOREZE_ROOM_SERVICE_ERP_URL=http://127.0.0.1:8787/muller-fioreze/admin/erp/
```

Na instalacao, o Fioreze Suite grava `%LOCALAPPDATA%\Fioreze\Suite\erp-config.json`
somente com origem, slug e nome da unidade. Nenhuma senha ou credencial e gravada nesse arquivo.

Para apontar manualmente para outro ambiente autorizado:

```bash
FIOREZE_ROOM_SERVICE_ERP_URL=https://fioreze-portais-dev.marketing1-840.workers.dev/muller-fioreze/admin/erp/ npm start
```

## Variaveis

- `FIOREZE_ROOM_SERVICE_ERP_URL`: URL do ERP Room Service.
- `FIOREZE_ROOM_SERVICE_ALLOWED_HOSTS`: hosts extras separados por virgula.
- `FIOREZE_DESKTOP_DEVTOOLS=true`: habilita DevTools em desenvolvimento.

## Seguranca

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- preload minimo
- navegacao do app limitada ao ERP da unidade em hosts permitidos
- links externos somente `https` e em hosts permitidos
- sem credenciais no repositorio

## Preload

O navegador recebe apenas:

```js
window.fiorezeDesktop = {
  isElectron,
  minimize,
  toggleMaximize,
  close,
  reload,
  capturePage,
  getWindowState,
  getWindowAppearance,
  getPrintAgentStatus,
  restartPrintAgent,
  openPrintManager,
  getUpdateState,
  checkForUpdates,
  downloadAndInstallUpdate,
  deferUpdate,
  onUpdateState,
  platform,
  version
}
```

`getWindowAppearance` retorna `material: "solid"` e informa se os controles
nativos estao ativos. Nenhuma deteccao de material do sistema operacional e
necessaria.

## Superficie da janela

- Windows usa Window Controls Overlay sobre o fundo solido `#f7f8fa`; o overlay
  fica vazado somente para preservar o contorno CSS sob os botoes nativos.
- Titlebar e sidebar compartilham a mesma superficie solida.
- O painel principal desenha uma unica borda superior/esquerda com canto
  arredondado, incluindo a area sob minimizar, maximizar e fechar.
- A area principal, paginas, cards, formularios e modais permanecem opacos.
- Nao ha tentativa de simular Mica, Acrylic ou Fluent com APIs nativas ou CSS.

O status e lido de `%LOCALAPPDATA%\Fioreze\PrintAgent\runtime-status.json`, que
contem apenas dados operacionais sanitizados. Se o agente estiver parado, somente
`%LOCALAPPDATA%\Fioreze\Suite\Fioreze-Suite.exe --tray` pode ser iniciado.
Quando o gerenciador ja esta em execucao, o ERP grava apenas `show.request` para
trazer a janela existente para frente, evitando agentes concorrentes.

## Build Windows

```powershell
npm ci
npm test
npm run dist:win
npm run dist:release
```

O build local cria `release/win-unpacked/`. O release cria o instalador NSIS,
`latest.yml` e o blockmap. A Suite incorpora o instalador em
`Fioreze-ERP-Installer/` para que a primeira instalacao ja fique apta a receber OTA.
O usuario abre somente o atalho `ERP <unidade>`, que aponta para `Fioreze ERP.exe` dentro da instalacao local.
Se a Suite ainda nao tiver configurado uma unidade, o aplicativo mostra apenas uma tela local de orientacao e os controles da janela.

No navegador comum, `desktop-adapter.js` usa no-op seguro e os controles de janela ficam ocultos.

## Atualizacoes nativas

O aplicativo consulta `https://portal.hoteisfioreze.com.br/downloads/erp/latest.yml`.
O manifesto e os binarios versionados sao servidos pelo Worker a partir do bucket
R2 privado. O download nunca comeca automaticamente: o operador escolhe entre
`Baixar e instalar` e `Lembrar mais tarde`. O adiamento fica apenas no computador
e vale por 24 horas. O hash SHA-512 do `latest.yml` e validado pelo
`electron-updater`; os hashes SHA-256 tambem sao registrados no pacote da Suite.

Mudancas no ERP web continuam chegando imediatamente. O OTA existe apenas para
alteracoes da integracao nativa com Windows, impressao, captura e barra de titulo.

## Offline

Nesta fase, offline deve apenas exibir erro de conexao do navegador/Electron. Nao ha criacao de pedido offline, mudanca de status offline ou sincronizacao pendente.

## Testes

```bash
npm test
```

Os testes sao estaticos e garantem que o wrapper continua fino, sem credenciais e com as protecoes principais habilitadas.
