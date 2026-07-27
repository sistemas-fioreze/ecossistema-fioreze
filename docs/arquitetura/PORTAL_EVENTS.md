# Agenda de Eventos dos Portais

## Visão geral

A agenda de eventos é compartilhada pela plataforma e isolada por unidade. A Central Administrativa mantém os registros de `events`; os portais publicados consultam somente os eventos públicos do hotel identificado pelo `hotel_slug`.

O fluxo não duplica conteúdo no documento do construtor. A página nativa de Eventos e o bloco Evento em destaque carregam a mesma agenda pública, preservando atualizações de data, imagem e descrição em todos os portais da unidade.

## Gestão administrativa

A área **Central Administrativa > Eventos** permite selecionar uma unidade autorizada, buscar, filtrar e editar sua programação. Cada evento oferece:

- título;
- descrição curta para cards;
- descrição completa para a visualização editorial;
- imagem da Biblioteca de Mídia da mesma unidade;
- local, categoria e etiquetas;
- data e horário de início;
- data e horário de término opcionais;
- fuso horário da unidade;
- status de rascunho, publicado, cancelado ou arquivado;
- opção de manter o evento permanentemente no portal;
- botão de ação opcional, formado por texto e endereço HTTPS.

As APIs administrativas já existentes são:

```text
GET   /api/v1/admin/portal/content?hotel_id=:hotel_id
POST  /api/v1/admin/portal/events
PATCH /api/v1/admin/portal/events/:event_id
```

Todas exigem sessão, permissão administrativa e acesso ao hotel. A imagem precisa pertencer à mesma unidade. Texto e URL do botão são validados em conjunto, e a URL aceita somente HTTPS. Criações e alterações registram auditoria.

A data de início controla o ciclo de vida. Um evento publicado e não permanente deixa de aparecer nas APIs públicas quando `starts_at` é alcançado e passa a ser apresentado como arquivado na Central. O Worker executa `archiveExpiredPortalEvents` a cada quinze minutos para persistir `status = archived`. Criar ou editar um evento não permanente cuja data já passou também o grava diretamente como arquivado. Eventos marcados como permanentes continuam publicados até uma ação administrativa. O processo usa o fuso convertido para ISO UTC.

## Experiência pública

A API pública é:

```text
GET /api/v1/public/hotels/:hotel_slug/portal/events
```

Ela retorna somente eventos publicados que ainda não alcançaram a data inicial ou que foram marcados como permanentes. A resposta não usa cache compartilhado. A página conectada oferece:

- visualização em lista;
- filtros por categoria e etiquetas;
- consulta pelo período da estadia;
- calendário mês a mês;
- cards com imagem, data, resumo e horário;
- detalhe editorial em janela no desktop e página integral no mobile;
- descrição longa, local, categoria, etiquetas e botão de ação.

O layout segue a seção de Eventos do Portal do Hóspede legado, mas usa identidade, dados e mídia da unidade atual.

## Construtor visual

O editor oferece duas integrações:

1. **Página Eventos**: página de sistema única, sem blocos internos, conectada automaticamente à agenda.
2. **Bloco Evento em destaque**: pode apontar para um evento publicado específico ou escolher automaticamente o próximo evento disponível.

O bloco permite ajustar o rótulo, o texto da ação e a exibição da data e do resumo. Ele não copia dados do evento para o portal.

## Modelo de dados

As migrations `0003`, `0021`, `0022` e `0023` sustentam os dados editoriais e de mídia. A migration aditiva `0027_portal_event_permanence.sql` acrescenta `is_permanent`, com valor padrão falso, e o índice do ciclo público. Os registros existentes não são reescritos pela migration.

Nenhum conteúdo real é incluído em seed, teste ou documentação.
