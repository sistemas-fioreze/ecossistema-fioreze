# Electron do ERP Room Service

O wrapper Electron sera criado em PR proprio.

## Direcao

- Abrir a mesma URL online `/erp/room-service/`.
- Nao duplicar frontend.
- Nao embutir credenciais.
- Nao acessar D1 ou R2 diretamente.
- Nao usar Google Sheets, Apps Script ou servidor de impressao antigo.

## Requisitos de Seguranca

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true` quando compativel
- preload minimo
- navegacao externa bloqueada ou aberta no navegador padrao
- allowlist do dominio dev/producao autorizado

## API Exposta pelo Preload

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

No navegador, `desktop-adapter.js` usa no-op seguro.

## Offline

Nesta fase futura, offline deve apenas mostrar aviso. Nao criar pedidos offline e nao alterar status offline.
