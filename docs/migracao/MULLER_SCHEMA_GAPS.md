# Lacunas de schema para migracao do Room Service Muller

Data da analise: 2026-07-05

Nenhuma migration foi criada nesta tarefa. As migrations existentes 0001 a 0007 nao foram alteradas.

## Campos com destino adequado hoje

| Dado legado | Destino atual |
| --- | --- |
| Categoria | `categories` |
| Produto | `catalog_items.name` |
| Descricao | `catalog_items.description` |
| Preco | `catalog_items.price_cents` |
| Imagem simples | `catalog_items.image_url` e futuro `media_assets` |
| Disponibilidade/estoque | `catalog_item_availability` |
| Horario simples | `service_hours` |
| Pedido | `orders` |
| Itens do pedido | `order_items` |
| Historico de status | `order_status_history` |
| Evento de impressao | `print_events` |

## Campos sem destino ideal ou que exigem decisao

| Campo legado | Situacao atual | Recomendacao |
| --- | --- | --- |
| Celular/WhatsApp do hospede | Nao ha campo dedicado em `orders` | Propor campo opcional criptografavel/retencao curta ou nao importar |
| Local de Consumo | Nao ha campo dedicado | Propor `orders.delivery_location` ou `orders.consumption_location` |
| Atendente | Nao ha campo dedicado no pedido | Relacionar a `admin_users` ou registrar em `admin_audit_log` |
| Status Impressao legado | `print_events.status` existe, mas precisa mapeamento | Criar tabela de equivalencia antes de importar historico |
| Status pedido legado | `orders.status` existe, mas valores diferem | Criar tabela de equivalencia |
| Observacao livre | `orders.notes` existe, mas pode conter dado pessoal | Importar somente com politica de privacidade |
| Opcoes do produto | Pode ir em `metadata_json`, mas nao e ideal para operacao | Avaliar `catalog_item_options` futura |
| Medida | Pode ir em `metadata_json` | Decidir se deve aparecer como campo de produto |
| Tag / Tipo / Combo | Pode ir em `metadata_json` | Decidir se controla UI, combo ou agrupamento |
| Numero de linha legado | Nao ha campo dedicado | Usar hash de origem em metadados de importacao local, nao campo funcional |
| Chat | Nao ha modulo/schema dedicado | Adiar ate decisao sobre atendimento/chat |
| Cadastro de hospedes | Nao ha modulo/schema dedicado | Nao migrar para dev |
| Permissoes legadas | Admin schema existe, mas formato difere | Migrar conceitualmente, nao copiar JSON legado sem revisao |

## Possivel migration 0008 - proposta para discussao

Nao criar ainda. Se a migracao real exigir preservar melhor o fluxo operacional, uma migration futura poderia incluir:

```sql
-- Proposta conceitual, nao aplicada.
ALTER TABLE orders ADD COLUMN guest_phone TEXT;
ALTER TABLE orders ADD COLUMN delivery_location TEXT;
ALTER TABLE orders ADD COLUMN attendant_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN legacy_source_ref TEXT;

CREATE TABLE catalog_item_options (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  catalog_item_id TEXT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_delta_cents INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Riscos da proposta:

- `guest_phone` e `delivery_location` podem carregar dados pessoais e precisam politica de retencao.
- `attendant_user_id` exige que usuarios administrativos novos existam antes da importacao historica.
- `legacy_source_ref` nao deve expor IDs sensiveis; usar hash.
- Opcoes de produto precisam de entendimento completo do campo legado antes de modelagem final.

## Decisao atual

Para esta tarefa, o importador nao cria migration e nao escreve no D1. Campos sem destino ideal ficam documentados e bloqueados para importacao real ate aprovacao humana.
