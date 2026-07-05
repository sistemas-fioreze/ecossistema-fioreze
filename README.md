# Portais Fioreze

Fonte oficial do ecossistema digital da Familia Fioreze.

## Estrutura

- `Migração Arquivos Room service muller/`: entrada original do sistema legado. Deve permanecer intacta.
- `legacy/hoteis/muller-fioreze/`: copia organizada e sanitizada para referencia historica.
- `app/`: futuro sistema novo. Ainda nao iniciado.
- `docs/`: mapas, regras, inventario e plano de migracao.

## Estado atual

O primeiro hotel mapeado e `muller-fioreze`.

A arquitetura futura prevista usa Cloudflare Worker, Static Assets e D1, mas esta etapa nao inicia a migracao. O objetivo atual e apenas preservar, organizar e documentar o legado com impacto zero no sistema existente.
