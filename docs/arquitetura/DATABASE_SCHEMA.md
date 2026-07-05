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

## Administracao

- `admin_users`;
- `admin_roles`;
- `admin_permissions`;
- `admin_user_roles`;
- `admin_role_permissions`;
- `admin_hotel_access`;
- `admin_sessions`;
- `admin_audit_log`.

## Portal Do Hospede

- `portal_pages`;
- `portal_sections`;
- `portal_content_items`;
- `events`;
- `hotel_information`.

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
- auditoria por hotel, modulo e data;
- pedidos por hotel, modulo e status;
- eventos por hotel, status e horario.
