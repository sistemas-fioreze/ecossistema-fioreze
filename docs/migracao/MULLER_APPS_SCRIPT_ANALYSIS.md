# Analise do Apps Script legado do Room Service Muller

Data da analise: 2026-07-05

Arquivo analisado: `Appscript.gs`

Esta analise foi feita por leitura estatica local. O Apps Script nao foi executado, publicado ou chamado.

## Resumo

- Funcoes detectadas: 24
- `doGet`: presente
- `doPost`: presente
- Uso de planilhas: sim
- Uso de `ContentService`: sim
- Uso de `LockService`: nao detectado
- Uso de `CacheService`: nao detectado
- Uso de `PropertiesService`: nao detectado
- Uso de `UrlFetchApp`: nao detectado
- Gatilhos Apps Script: nao detectados
- Categoria sensivel detectada: logica/campo de senha

## Funcoes identificadas

- `jsonOut`
- `ssSistema`
- `ssCardapio`
- `normalizeKey`
- `getSheetOrCreate`
- `getHeaderMap`
- `col`
- `userCols`
- `ensureUserColumns`
- `parseJSONCell`
- `userObject`
- `appendUserLog`
- `hashPassword`
- `isPasswordValid`
- `parseClockMinutes`
- `formatClockValue`
- `isNowInsideWindow`
- `storeParamCols`
- `readStoreTime`
- `getStoreParams`
- `requireMaster`
- `doPost`
- `appendUserLogByName`
- `doGet`

## Abas referenciadas diretamente

- Cardapio
- Codigo
- Changelog

Outras abas sao criadas ou acessadas dinamicamente durante a execucao do legado, como pedidos, usuarios, hospedes e chat.

## Parametros e consultas

Parametros observados em leitura estatica:

- `q`
- `codigo`
- `nivel`
- `quarto`

Rotas conceituais do `doGet`:

| Consulta | Finalidade | Migracao |
| --- | --- | --- |
| site/internal | Retorna HTML armazenado na aba Codigo | Nao migrar; novo front vive em Static Assets |
| poll_login | Polling de contagem de pedidos | Reimplementar via API/admin futura se necessario |
| poll_guest | Chat/status do hospede | Precisa de decisao humana |
| poll_internal | Chat/notificacoes/pedidos para ERP | Reimplementar no ERP novo |
| guests | Lista hospedes legados | Nao usar em dev com dados reais |
| store_status | Estado aberto/fechado e horarios | Ja existe parcialmente via `service_hours` |
| init_data | Inicializacao de usuarios, cardapio e parametros | Separar em bootstrap, produtos e rotas admin |
| orders | Lista pedidos da planilha | Reimplementar via `orders` e `order_items` |
| changelog | Historico de versoes | Opcional/documental |
| user_log | Log de usuario | Reimplementar via `admin_audit_log` se necessario |

## Acoes do `doPost`

| Acao | Finalidade | Classificacao |
| --- | --- | --- |
| login/logout | Sessao de usuarios do ERP legado | Precisa ser reimplementado com autenticacao segura |
| log_user_action | Log operacional de usuario | Reimplementar em `admin_audit_log` |
| mark_changelog_seen | Preferencia local de usuario | Decisao humana |
| save_user_preferences | Tema/notificacoes/escala | Decisao humana |
| save_user_permissions | Permissoes de usuario | Reimplementar com roles/permissoes |
| save_user/delete_user | CRUD de usuarios | Reimplementar no ERP; nao migrar senhas |
| request_password_change/change_own_password | Fluxo de senha legado | Nao reutilizar diretamente |
| send_chat/end_chat | Chat legado | Decisao humana |
| sync_hospede/delete_guest | Cadastro/cache de hospedes | Nao importar dados reais nesta fase |
| add_order | Cria pedido na planilha | Ja existe parcialmente no Worker/D1 |
| edit_order | Edita pedido legado | Reimplementar no ERP futuro |
| update_order_status | Atualiza status de pedido/impressao | Reimplementar com `order_status_history` e `print_events` |
| reprint_order/delete_order | Reimpressao/exclusao | Impressao desativada; exclusao exige politica |
| clear_notif | Limpa notificacoes | Decisao humana |
| save_menu_item | CRUD de item do cardapio | Reimplementar via ERP/catalogo |
| toggle_stock | Disponibilidade/estoque | Mapear para `catalog_item_availability` |
| delete_menu_item | Exclusao de item | Usar status archived/inactive em vez de apagar sem criterio |
| update_store_status | Horario/abertura manual | Mapear para `service_hours` e possivel setting manual |

## Regras de negocio encontradas

| Comportamento | Classificacao |
| --- | --- |
| Receber GET/POST JSON | Deve ser preservado como API Worker |
| Ler planilhas | Precisa ser reimplementado via D1 |
| Gravar pedidos | Ja existe parcialmente no Worker/D1 |
| Hash/validacao de senha legado | Nao reutilizar diretamente |
| Controle de horario aberto/fechado | Ja existe parcialmente via `service_hours` |
| CRUD de cardapio | Precisa ser reimplementado no ERP novo |
| Toggle de estoque | Precisa ser preservado em `catalog_item_availability` |
| Reimpressao | Nao migrar nesta fase |
| Chat/hospedes/notificacoes | Precisa de decisao humana |
| Codigo HTML salvo em planilha | Nao deve ser migrado |

## Formatos JSON observados

O legado retorna JSON para inicializacao, cardapio, pedidos, status de loja, usuarios, logs e changelog. A nova plataforma deve separar esses contratos:

- Publico: bootstrap, produtos, criacao de pedido.
- Administrativo: usuarios, permissoes, pedidos, catalogo, auditoria.
- Futuro: chat, notificacoes, relatorios.

## Lacunas de seguranca do legado a nao repetir

- HTML armazenado em planilha.
- Senhas/fluxos de senha herdados da planilha.
- Polling amplo retornando dados administrativos.
- Pedidos e dados pessoais misturados em planilhas.
- Impressao acoplada ao status da planilha.

## Conclusao

O Apps Script deve servir apenas como fonte de regras. Nenhum codigo especifico deve ser reutilizado diretamente. A migracao deve preservar os comportamentos essenciais: catalogo, disponibilidade, horario, criacao de pedido, status e auditoria, mas usando Worker, D1, autenticacao nova e impressao desacoplada/desativada.
