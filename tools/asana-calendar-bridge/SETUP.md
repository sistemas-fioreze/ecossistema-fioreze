# Setup de credenciais — Asana → Google Calendar

O Worker já conhece o workspace do Asana pela configuração versionada. Não armazene tokens neste repositório.

## Secrets necessários no Worker

```text
ASANA_ACCESS_TOKEN
GOOGLE_CALENDAR_ID
GOOGLE_SERVICE_ACCOUNT_JSON
```

## Asana

Crie um Personal Access Token na conta que será sincronizada e grave-o diretamente no Worker:

```powershell
npx wrangler secret put ASANA_ACCESS_TOKEN --config tools/asana-calendar-bridge/wrangler.jsonc
```

Cole o token apenas no prompt do Wrangler. Não salve o token em arquivo ou GitHub Actions.

## Google Calendar

1. No Google Cloud, habilite a Google Calendar API.
2. Crie uma Service Account e uma chave JSON.
3. No Google Calendar, crie/escolha o calendário que receberá as tarefas.
4. Compartilhe esse calendário com o `client_email` da Service Account com permissão para alterar eventos.
5. Copie o ID do calendário em **Configurações e compartilhamento → Integrar agenda → ID da agenda**.
6. Grave o ID:

```powershell
npx wrangler secret put GOOGLE_CALENDAR_ID --config tools/asana-calendar-bridge/wrangler.jsonc
```

7. Grave o JSON completo da Service Account:

```powershell
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON --config tools/asana-calendar-bridge/wrangler.jsonc
```

Cole o JSON completo no prompt do Wrangler. Não versione a chave.

## Verificação

Abra:

```text
https://fioreze-asana-calendar-bridge.marketing1-840.workers.dev/health
```

Os quatro indicadores de configuração devem aparecer como `true`.

O Cron executa a sincronização automaticamente a cada 5 minutos.
