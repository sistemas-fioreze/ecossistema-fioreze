# Setup — Asana ↔ Google Tasks + Google Calendar

O Worker usa dois destinos:

- tarefas do Asana **sem horário** → Google Tasks (aparecem como tarefas no Google Calendar);
- tarefas do Asana **com horário** → eventos no calendário `Asana`, preservando o horário.

A conclusão das Google Tasks é bidirecional com o Asana. Nome, notas e datas continuam tendo o Asana como fonte principal. O Cron roda a cada 5 minutos.

## Configuração já existente

```text
ASANA_ACCESS_TOKEN
ASANA_WORKSPACE_GID
GOOGLE_CALENDAR_ID
GOOGLE_SERVICE_ACCOUNT_JSON
```

Esses valores mantêm o modo atual funcionando enquanto o OAuth do Google Tasks ainda não estiver configurado.

## Google Tasks API

No mesmo projeto do Google Cloud:

1. Habilite **Google Tasks API**.
2. Abra **Google Auth Platform / OAuth consent screen** e configure o aplicativo.
3. Adicione o escopo:

```text
https://www.googleapis.com/auth/tasks
```

4. Crie um **OAuth Client ID** do tipo **Web application**.
5. Adicione exatamente esta URI em **Authorized redirect URIs**:

```text
https://fioreze-asana-calendar-bridge.marketing1-840.workers.dev/oauth/callback
```

6. No Worker da Cloudflare, salve como `Secret`:

```text
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
```

7. Abra no navegador:

```text
https://fioreze-asana-calendar-bridge.marketing1-840.workers.dev/oauth/start
```

8. Autorize usando a mesma Conta Google em que as tarefas devem aparecer.
9. O callback exibirá um refresh token uma única vez. Grave-o na Cloudflare como `Secret`:

```text
GOOGLE_OAUTH_REFRESH_TOKEN
```

Não salve client secret nem refresh token no GitHub.

> Atenção: projetos OAuth externos com status **Testing** recebem refresh tokens que normalmente expiram em 7 dias. Para uma integração permanente, ajuste o estado de publicação de acordo com a política do Google para o seu uso.

## Ativação automática

O `/health` informa o modo atual:

```text
legacy-calendar-events
```

Enquanto faltar algum secret do OAuth do Google Tasks, nada muda e o bridge continua usando eventos.

Quando estes três estiverem presentes:

```text
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_REFRESH_TOKEN
```

o Worker muda automaticamente para:

```text
hybrid-google-tasks
```

Na primeira sincronização híbrida:

- os antigos eventos de dia inteiro gerenciados pelo bridge são removidos;
- tarefas sem horário são criadas na lista Google Tasks `Asana`;
- tarefas com horário continuam como eventos;
- concluir uma Google Task pode concluir a tarefa correspondente no Asana;
- concluir no Asana marca a Google Task como concluída;
- se uma tarefa concluída for reaberta, a alteração mais recente entre Asana e Google vence.

## Verificação

Abra:

```text
https://fioreze-asana-calendar-bridge.marketing1-840.workers.dev/health
```

O estado final deve mostrar:

```text
mode: hybrid-google-tasks
configured.googleTasksClientId: true
configured.googleTasksClientSecret: true
configured.googleTasksRefreshToken: true
configured.hybridReady: true
```
