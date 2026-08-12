# ERP Room Service Desktop

Wrapper Electron fino para abrir o ERP Room Service oficial em `/<slug-da-unidade>/admin/erp/`.

## Papel do pacote

- Nao duplica HTML, CSS, JavaScript ou backend do ERP.
- Nao acessa D1, R2, Apps Script, Google Sheets ou impressora diretamente.
- Nao embute credenciais, tokens ou senhas.
- Usa a sessao administrativa controlada pelo Worker.
- Usa a Window Controls Overlay oficial do Electron para preservar os controles
  nativos, Snap Layouts, Alt + Space, redimensionamento e DPI do Windows.
- No Windows 11 22H2 ou superior, titlebar e sidebar expõem Mica nativo. No
  Windows 10, Windows 11 antigo, sessao remota ou falha da API, usam uma
  superficie Fluent estavel sem DLL, hook ou API privada.
- Mantem atualizar e estado da impressao na titlebar integrada ao Windows.
- Carrega a URL oficial da unidade; alteracoes publicadas aparecem sem reinstalar o aplicativo.
- Consulta e reinicia o Fioreze Print Agent por um canal local restrito.

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
  getWindowState,
  getWindowAppearance,
  getPrintAgentStatus,
  restartPrintAgent,
  openPrintManager,
  platform,
  version
}
```

`getWindowAppearance` retorna somente `material` (`mica`, `fluent` ou `solid`)
e se os controles nativos estao ativos. Build do Windows e detalhes internos da
decisao permanecem no processo Main.

## Materiais do Windows

- Windows 11 build 22621 ou superior: `setBackgroundMaterial("mica")`.
- Windows 10 e Windows 11 sem Mica: fallback Fluent opaco/semitranslucido.
- Alto contraste ou plataforma nao suportada: fallback solido legivel.
- A area principal, paginas, cards, formularios e modais permanecem opacos.
- A decisao usa `os.release()` no Main e a disponibilidade real da API. Nao usa
  user-agent no renderer.

O Electron nao oferece Acrylic nativo para Windows 10 pela API utilizada neste
pacote. Por isso o fallback nao tenta simular o desktop com hacks ou blur amplo.

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
```

O aplicativo e criado em `release/win-unpacked/` e incorporado pelo build da Suite como `Fioreze-ERP/`.
O usuario abre somente o atalho `ERP <unidade>`, que aponta para `Fioreze ERP.exe` dentro da instalacao local.
Se a Suite ainda nao tiver configurado uma unidade, o aplicativo mostra apenas uma tela local de orientacao e os controles da janela.

No navegador comum, `desktop-adapter.js` usa no-op seguro e os controles de janela ficam ocultos.

## Offline

Nesta fase, offline deve apenas exibir erro de conexao do navegador/Electron. Nao ha criacao de pedido offline, mudanca de status offline ou sincronizacao pendente.

## Testes

```bash
npm test
```

Os testes sao estaticos e garantem que o wrapper continua fino, sem credenciais e com as protecoes principais habilitadas.
