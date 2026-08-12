# Electron do ERP Room Service

O wrapper Electron fica em `desktop/room-service/` e abre a mesma aplicacao online do ERP em `/erp/room-service/`.

## Direcao

- Abrir a mesma URL online `/erp/room-service/`.
- Nao duplicar frontend.
- Nao embutir credenciais.
- Nao acessar D1 ou R2 diretamente.
- Nao usar Google Sheets, Apps Script ou servidor de impressao antigo.
- Usar a sessao administrativa do Worker, sem token proprio do desktop.
- Persistir somente preferencias visuais no frontend compartilhado.

## Requisitos de Seguranca

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- preload minimo
- barra de titulo branca renderizada pelo frontend compartilhado
- abertura e reinicio do agente por acoes locais fixas, sem shell arbitrario
- navegacao externa bloqueada ou aberta no navegador padrao
- allowlist de hosts autorizados
- DevTools habilitado somente por variavel de ambiente

O processo principal valida que a navegacao interna permanece em `/erp/room-service/`. Links fora do escopo do app nao substituem a janela principal.

## API Exposta pelo Preload

```js
window.fiorezeDesktop = {
  isElectron,
  minimize,
  toggleMaximize,
  close,
  reload,
  getPrintAgentStatus,
  restartPrintAgent,
  openPrintManager,
  platform,
  version
}
```

No navegador, `desktop-adapter.js` usa no-op seguro.

## Configuracao local

Padrao de desenvolvimento:

```text
http://127.0.0.1:8787/erp/room-service/
```

Variaveis:

- `FIOREZE_ROOM_SERVICE_ERP_URL`
- `FIOREZE_ROOM_SERVICE_ALLOWED_HOSTS`
- `FIOREZE_DESKTOP_DEVTOOLS=true`

Nenhuma delas deve conter segredo.

## Offline

Nesta fase, offline deve apenas mostrar erro de conexao. Nao criar pedidos offline, nao alterar status offline e nao prometer sincronizacao.

## Testes

O pacote possui testes estaticos para garantir:

- hardening do `BrowserWindow`;
- preload restrito;
- ausencia de integracoes legadas;
- ausencia de acesso direto a D1/R2;
- controles de janela ocultos no navegador comum.
