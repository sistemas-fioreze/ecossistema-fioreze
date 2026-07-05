# Mapeamento de dados Muller para D1

Data da analise: 2026-07-05

Nenhum dado real foi importado. Esta matriz descreve transformacoes futuras.

| Origem antiga | Campo antigo | Destino D1 | Transformacao necessaria | Risco | Validacao | Observacao |
| --- | --- | --- | --- | --- | --- | --- |
| Cardapio | Categoria | `categories.name` | Normalizar texto e gerar ID estavel | Baixo | Categoria nao vazia | Usar `hotel_id=muller-fioreze` e `module_key=room-service` |
| Cardapio | Nome do Prato | `catalog_items.name` | Normalizar espacos | Baixo | Nome obrigatorio | Duplicidades devem ser revisadas |
| Cardapio | Descricao | `catalog_items.description` | Preservar texto publico | Baixo | Campo opcional | Conteudo permitido no dev se for catalogo publico |
| Cardapio | Preco | `catalog_items.price_cents` | Converter moeda brasileira para centavos | Medio | Inteiro >= 0 | Auditoria encontrou 0 precos invalidos |
| Cardapio | Link da Imagem | `catalog_items.image_url` e futuro `media_assets` | Validar origem e migrar imagem autorizada | Medio | URL/local path valido | Nao baixar imagens nesta tarefa |
| Cardapio | Estoque | `catalog_item_availability.is_available` | Converter disponibilidade para 0/1 | Baixo | Booleano valido | Produto indisponivel deve continuar visivel/desabilitado ou oculto conforme regra final |
| Cardapio | Tag | `catalog_items.metadata_json` ou campo futuro | Guardar metadado ou criar schema | Baixo | Valor enumerado | Decisao futura |
| Cardapio | Medida | `catalog_items.metadata_json` ou campo futuro | Guardar metadado estruturado | Baixo | Campo opcional | Pode impactar layout do card |
| Cardapio | Opcoes | `catalog_items.metadata_json` ou `selected_options_snapshot` em pedidos | Separar lista por delimitador confiavel | Medio | Parser deterministico | Pode exigir migration 0008 |
| Cardapio | Coluna 1 / Coluna 2 | `metadata_json` ou campos especificos | Identificar finalidade antes de importar | Medio | Decisao humana | Parece representar tipo/combo no Apps Script |
| Parametros | Status | `hotel_settings` ou controle operacional futuro | Mapear abertura manual | Medio | Estado permitido | Nao existe campo manual dedicado |
| Parametros | Abertura/Fechamento | `service_hours.opens_at/closes_at` | Converter HH:mm e dia da semana | Baixo | Horario valido | Hoje ha uma faixa simples |
| Pedidos | Data/Hora | `orders.created_at` | Converter para ISO 8601 com timezone | Medio | Data valida | Auditoria encontrou 0 datas invalidas |
| Pedidos | Hospede | `orders.guest_name` | Somente em importacao autorizada/anônima | Alto | Politica LGPD | Nao usar em dev com valor real |
| Pedidos | Quarto | `orders.room_code` | Normalizar codigo de acomodacao | Alto | Pertence ao hotel | Pode ser dado pessoal/operacional |
| Pedidos | Pedido | `order_items` e snapshots | Quebrar texto legado em itens/quantidades | Alto | Total confere | Parser ainda precisa ser especificado |
| Pedidos | Total | `orders.total_cents` | Converter moeda para centavos | Medio | Soma dos itens | Historico pode divergir de catalogo atual |
| Pedidos | Status Impressao | `print_events.status` | Mapear status legado para enum novo | Medio | Enum conhecido | Impressao permanece desativada |
| Pedidos | Local de Consumo | Campo futuro ou `orders.notes` temporario | Criar destino explicito recomendado | Medio | Campo opcional | Nao improvisar em `notes` na migracao real |
| Pedidos | Atendente | `admin_audit_log` ou campo futuro | Relacionar a usuario admin se existir | Alto | Usuario autorizado | Pode conter nome pessoal |
| Pedidos | Status pedido | `orders.status` e `order_status_history.status` | Mapear enum legado para enum D1 | Medio | Enum conhecido | Auditoria marcou todos como status legado desconhecido |
| Pedidos | Observacao | Campo futuro ou `orders.notes` | Sanitizar e importar somente se autorizado | Alto | Sem dado sensivel indevido | Pode conter dados pessoais |
| Usuarios | Codigo/Nome/Nivel/Permissoes | `admin_users`, roles e permissoes | Recriar usuarios sem senha legada | Alto | Autenticacao nova | Nao importar senha/hash |
| Usuarios | Senha | Nenhum destino direto | Nao importar | Alto | Bloqueio obrigatorio | Criar usuarios com fluxo novo |
| Hospedes | Nome/Celular/CPF/E-mail | Nenhum destino nesta fase | Nao importar no dev | Alto | Consentimento/finalidade | Grupo B/C |
| Chat | Mensagem | Modulo futuro de chat | Decisao humana | Alto | Politica de retencao | Nao importar agora |
| Codigo | HTML legado | Repositorio/Static Assets novos | Nao migrar dado da planilha | Medio | Codigo versionado | Usar apenas como referencia |
| Changelog | Data/Versao/Log | Docs ou `admin_audit_log` futuro | Sanitizar se preservar | Baixo | Sem dados pessoais | Opcional |

## Entidades novas envolvidas

- `hotels`
- `hotel_branding`
- `hotel_settings`
- `hotel_modules`
- `navigation_items`
- `rooms`
- `service_hours`
- `catalogs`
- `categories`
- `catalog_items`
- `catalog_item_availability`
- `media_assets`
- `orders`
- `order_items`
- `order_status_history`
- `print_events`
- `admin_users`
- `admin_roles`
- `admin_permissions`
- `admin_audit_log`

## Transformacoes principais

- Moeda: `R$ 85,00` vira `8500`.
- Horario: `16:00` permanece `HH:mm` em `service_hours`.
- Disponibilidade: estoque/status legado vira `is_available`.
- Imagem: link antigo deve virar asset autorizado antes de gravar em `media_assets`.
- Pedido historico: precisa parser proprio antes de virar `orders` + `order_items`.
- Status legado: precisa tabela de equivalencia antes de virar enum D1.
