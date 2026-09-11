# Asana → Google Calendar Bridge

Worker independente para espelhar as tarefas incompletas do **My Tasks** do usuário autenticado no Asana para um calendário do Google.

## Como funciona

- executa a cada 5 minutos via Cloudflare Cron Trigger;
- lê `GET /tasks?assignee=me&workspace=...&completed_since=now` no Asana;
- tarefas com `due_on` viram eventos de dia inteiro;
- tarefas com `due_at` viram eventos com horário;
- `start_on` / `start_at`, quando presentes, definem o início do evento;
- atualizações no Asana atualizam o evento correspondente;
- tarefas concluídas, desatribuídas ou sem data removem o evento gerenciado;
- o vínculo Asana ↔ Calendar usa `extendedProperties.private`, portanto não precisa de D1/KV;
- eventos são criados como `transparent` por padrão para não bloquear disponibilidade.

A sincronização é **Asana → Google Calendar**. Alterações feitas manualmente no evento do Google são corrigidas pelo próximo ciclo com base no Asana.

## Worker

Nome: `fioreze-asana-calendar-bridge`

Health check:

```text
GET /health
```

O health check informa apenas se os secrets obrigatórios estão configurados; nunca retorna seus valores.

## Secrets obrigatórios

Configure os quatro secrets diretamente no Worker da Cloudflare:

```bash
npx wrangler secret put ASANA_ACCESS_TOKEN
npx wrangler secret put ASANA_WORKSPACE_GID
npx wrangler secret put GOOGLE_CALENDAR_ID
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
```

### ASANA_ACCESS_TOKEN

Personal Access Token do usuário cuja lista `My Tasks` será sincronizada.

### ASANA_WORKSPACE_GID

GID do workspace do Asana.

### GOOGLE_CALENDAR_ID

ID do calendário de destino. Recomenda-se um calendário separado, por exemplo `Asana`.

### GOOGLE_SERVICE_ACCOUNT_JSON

Conteúdo completo do JSON de uma Service Account do Google Cloud.

A Service Account precisa ter acesso de edição ao calendário escolhido. No Google Calendar, compartilhe o calendário com o `client_email` do JSON da Service Account e conceda permissão para **fazer alterações nos eventos**.

A Google Calendar API precisa estar ativada no projeto do Google Cloud que contém a Service Account.

## Deploy

O workflow `.github/workflows/deploy-asana-calendar-bridge.yml` usa os secrets de Cloudflare já mantidos no repositório:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Pushes em `main` que alterem este diretório fazem deploy somente deste Worker.

Também é possível executar manualmente:

```bash
npx wrangler@4 deploy --config tools/asana-calendar-bridge/wrangler.jsonc
```

## Mapeamento

| Asana | Google Calendar |
| --- | --- |
| `name` | título |
| `notes` | descrição |
| `permalink_url` | link dentro da descrição |
| `due_on` | evento de dia inteiro |
| `start_on` + `due_on` | intervalo de dias |
| `due_at` | início do evento, quando não há `start_at` |
| `start_at` + `due_at` | início e fim do evento |
| tarefa concluída/desatribuída/sem data | evento removido |

Quando uma tarefa só tem `due_at`, a duração padrão do evento é 60 minutos. Ela pode ser ajustada em `DEFAULT_EVENT_DURATION_MINUTES` no `wrangler.jsonc`.

## Segurança

- nenhum token ou JSON de credencial deve ser commitado;
- o Worker pede somente o escopo Google `calendar.events`;
- o endpoint público não permite executar sincronização manual;
- o calendário de destino deve ser dedicado quando possível, reduzindo o alcance da Service Account;
- apenas eventos marcados com o `BRIDGE_ID` do Worker são alterados ou removidos.
