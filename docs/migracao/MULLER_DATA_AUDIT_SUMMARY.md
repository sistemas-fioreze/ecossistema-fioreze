# Resumo da auditoria de qualidade dos dados Muller

Data da analise: 2026-07-05

Relatorio detalhado local, ignorado pelo Git:

- `local-output/muller/data-audit.json`

## Catalogo

| Verificacao | Resultado |
| --- | ---: |
| Produtos encontrados | 78 |
| Categorias encontradas | 16 |
| Produtos sem categoria | 0 |
| Produtos sem nome | 0 |
| Produtos sem preco | 0 |
| Precos invalidos | 0 |
| Precos negativos | 0 |
| Moedas detectadas | 1 |
| IDs duplicados gerados | 0 |
| Nomes duplicados | 2 |
| Produtos arquivados | 0 |
| Produtos indisponiveis | 1 |
| Links de imagem invalidos | 0 |

Moeda detectada: BRL.

## Pedidos e historico operacional

| Verificacao | Resultado |
| --- | ---: |
| Registros de pedido encontrados | 160 |
| Datas invalidas | 0 |
| Pedidos duplicados pelo hash local | 0 |
| Status legados sem mapeamento D1 | 160 |
| Linhas incompletas relevantes | 0 |

Observacao: os status legados nao foram listados para evitar expor dados operacionais. Antes de importar historico, criar tabela de equivalencia para `orders.status`, `order_status_history.status` e `print_events.status`.

## Planilhas

- Total de arquivos XLSX analisados: 2
- Total de abas analisadas: 8
- Total de formulas detectadas: 0
- Validacoes de dados detectadas: 6
- Links detectados no catalogo: 10

## Inconsistencias e pontos de atencao

- Ha 2 nomes de produtos duplicados ou equivalentes apos normalizacao.
- Ha 1 produto indisponivel no catalogo.
- A aba `Pedidos` possui status legados que precisam de mapeamento.
- A aba `Usuarios` contem campo de senha e nao deve ser importada diretamente.
- A aba `Hospedes` contem dados pessoais e nao deve ir para desenvolvimento com valores reais.
- A aba `Codigo` contem referencia a codigo/endpoint legado e nao deve ser migrada como dado.

## Dry-run

Resultado do dry-run real, gravado apenas em `local-output/muller/`:

| Item | Resultado |
| --- | ---: |
| Catalogos candidatos | 1 |
| Categorias candidatas | 16 |
| Produtos candidatos | 78 |
| Produtos inseriveis | 78 |
| Linhas ignoradas | 0 |
| Statements parametrizados gerados | 173 |

Arquivos gerados localmente:

- `catalog.normalized.json`
- `orders.anonymized.json`
- `validation-report.json`
- `data-audit.json`
- `import-preview.sql`
- `import-preview.parameters.json`
