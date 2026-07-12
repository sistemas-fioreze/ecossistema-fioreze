# ERP Room Service Desktop

Wrapper Electron fino para abrir o ERP Room Service oficial em `/erp/room-service/`.

## Papel do pacote

- Nao duplica HTML, CSS, JavaScript ou backend do ERP.
- Nao acessa D1, R2, Apps Script, Google Sheets ou impressora diretamente.
- Nao embute credenciais, tokens ou senhas.
- Usa a sessao administrativa controlada pelo Worker.

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

Por padrao, o app carrega:

```text
http://127.0.0.1:8787/erp/room-service/
```

Para apontar para outro ambiente autorizado:

```bash
FIOREZE_ROOM_SERVICE_ERP_URL=https://fioreze-portais-dev.marketing1-840.workers.dev/erp/room-service/ npm start
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
- navegacao do app limitada a `/erp/room-service/` em hosts permitidos
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
  platform,
  version
}
```

No navegador comum, `desktop-adapter.js` usa no-op seguro e os controles de janela ficam ocultos.

## Offline

Nesta fase, offline deve apenas exibir erro de conexao do navegador/Electron. Nao ha criacao de pedido offline, mudanca de status offline ou sincronizacao pendente.

## Testes

```bash
npm test
```

Os testes sao estaticos e garantem que o wrapper continua fino, sem credenciais e com as protecoes principais habilitadas.
