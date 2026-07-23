# Esquema Do Banco D1

O schema inicial e versionado por migrations em `app/migrations/`.

## Core Multi-hotel

- `hotels`: tenant principal.
- `hotel_domains`: dominios e subdominios futuros.
- `hotel_branding`: identidade visual publica.
- `hotel_settings`: configuracoes publicas e internas.
- `modules`: catalogo de modulos.
- `hotel_modules`: habilitacao de modulo por hotel.
- `navigation_items`: navegacao publica.
- `features` e `hotel_features`: feature flags.
- `rooms`: quartos ou acomodacoes por hotel.
- `service_hours`: horarios operacionais por hotel e modulo.
- `media_assets`: metadados de midias e assets, sem binarios no D1.
- `media_folders`: pastas e subpastas de midia isoladas por hotel.

`service_hours` e a fonte canonica de horarios operacionais. Cada linha pertence a um hotel e modulo, usa o timezone do proprio hotel em `hotels.timezone`, permite mais de uma faixa no mesmo dia por `sort_order` e aceita horarios que atravessem a meia-noite. `hotel_settings` deve guardar apenas configuracoes que nao possuam tabela especializada.

`media_assets` guarda apenas metadados, como `storage_provider`, `object_key`, `public_url`, texto alternativo, tipo MIME, pasta e status. Binarios R2 permanecem no bucket privado. `media_folders` organiza a biblioteca sem incorporar o caminho da pasta no `object_key`, portanto mover imagens nao quebra URLs publicas.

## Administracao

- `admin_users`;
- `admin_roles`;
- `admin_permissions`;
- `admin_user_roles`;
- `admin_role_permissions`;
- `admin_hotel_access`;
- `admin_sessions`;
- `admin_audit_log`.

`admin_user_preferences` permanece apenas como tabela historica de compatibilidade da migration `0017`; a Central nao oferece mais paletas pessoais nem expoe API para alterar aparencia.

## Portal Do Hospede

- `portal_pages`;
- `portal_sections`;
- `portal_content_items`;
- `events`;
- `hotel_information`.

`events` mantem titulo e resumo para listagens e tambem oferece `content`, `location`, `category` e `tags_json` para a pagina editorial completa. `action_text` e `action_url`, adicionados por `0023_guest_portal_event_actions.sql`, formam um botao opcional; a API administrativa exige os dois campos em conjunto e aceita somente URL HTTPS. `tags_json` deve ser um array JSON, e o indice `hotel_id + category + status + starts_at` atende filtros publicos sem atravessar unidades. As extensoes nao importam conteudo real.

## Catalogos Compartilhados

- `catalogs`;
- `categories`;
- `catalog_items`;
- `catalog_item_availability`.

Essas tabelas atendem Room Service, Emporio e alguns servicos quando o modelo de catalogo for suficiente.

## Room Service E Emporio

- `orders`;
- `order_items`;
- `order_status_history`;
- `print_events`.

Pedidos guardam `hotel_id`, `module_key`, origem, acomodacao quando aplicavel, valores em centavos, status e timestamps.

## Spa

- `spa_services`;
- `spa_service_requests`;
- `spa_appointments`.

## Pacotes Romanticos

- `romantic_packages`;
- `romantic_package_requests`.

## Relacionamentos Principais

- `hotel_modules.hotel_id` referencia `hotels.id`.
- `hotel_modules.module_key` referencia `modules.module_key`.
- `service_hours.hotel_id` referencia `hotels.id`.
- `service_hours.module_key` referencia `modules.module_key` com delecao restrita, seguindo o padrao de tabelas de modulo.
- `media_assets.hotel_id` referencia `hotels.id` e pode ser nulo para assets compartilhados.
- `media_assets.module_key` referencia `modules.module_key` e usa `ON DELETE SET NULL`, porque o asset pode continuar existindo como metadado compartilhado mesmo se deixar de pertencer a um modulo.
- `media_assets.folder_id` referencia `media_folders.id` e usa `ON DELETE SET NULL`.
- `media_folders.hotel_id` referencia `hotels.id`; `media_folders.parent_id` referencia outra pasta e a aplicacao impede ciclos e mistura de hoteis.
- A tabela historica `admin_user_preferences` referencia `admin_users.id` com `ON DELETE CASCADE`, mas nao participa do runtime atual.
- `catalog_items` pertence a `hotels`, `catalogs`, `categories` e `modules`.
- `orders` pertence a `hotels`, `modules` e opcionalmente `rooms`.
- `order_items` pertence a `orders` e preserva snapshot de nome e preco.
- `print_events` pertence a `orders`, mas impressao fica desativada nesta fase.
- `admin_hotel_access` limita quais hoteis um usuario pode operar no ERP.

## Indices

Indices iniciais cobrem:

- `hotel_id`;
- `hotel_id + module_key`;
- `hotel_id + status`;
- `hotel_id + created_at`;
- `catalog_id + category_id`;
- `hotel_id + module_key + enabled`;
- `service_hours`: `hotel_id + module_key + status`, `hotel_id + module_key + day_of_week`, `hotel_id + status`;
- `media_assets`: `hotel_id + status`, `hotel_id + module_key + status`, `hotel_id + folder_id + status`, `storage_provider + status`;
- `media_folders`: `hotel_id + parent_id + archived_at + name` e nome ativo unico por pasta-pai;
- auditoria por hotel, modulo e data;
- pedidos por hotel, modulo e status;
- eventos por hotel, status e horario.

## Guardas Administrativas De Pedidos

A migration `0007_admin_orders_guards.sql` prepara o indice unico:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_status_history_order_status
ON order_status_history(order_id, status);
```

Antes de aplicar essa migration em qualquer D1 compartilhado, verificar duplicidades:

```sql
SELECT order_id, status, COUNT(*) AS total
FROM order_status_history
GROUP BY order_id, status
HAVING COUNT(*) > 1;
```

Esse indice protege transicoes concorrentes no ERP: para um mesmo pedido, cada status pode aparecer no historico apenas uma vez.

## Migrations Incrementais

A migration `0007_core_service_hours_media_assets.sql` e incremental porque `0001` a `0006` ja foram aplicadas no D1 remoto de desenvolvimento. Migrations ja aplicadas nao devem ser editadas, renomeadas ou reaplicadas; qualquer mudanca posterior de schema deve usar a proxima migration global disponivel.
