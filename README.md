# Ecossistema Fioreze

Repositorio oficial da plataforma digital unificada da Familia Fioreze.

## Estrutura

- `legacy/`: copias sanitizadas dos sistemas antigos, separadas por hotel e modulo. E referencia historica e nao deve ser publicada como sistema novo.
- `app/`: plataforma nova compartilhada, com Cloudflare Worker, Workers Static Assets, D1 local, front-end, migrations, seeds, testes e ferramentas.
- `docs/`: documentacao de migracao, regras, operacao e arquitetura.
- `docs/arquitetura/`: contratos da plataforma nova, incluindo estrutura do repositorio, banco, API, autenticacao, impressao e modulos.

## Estado atual

O primeiro hotel e `muller-fioreze`. A plataforma possui Portal do Hospede compartilhado, Room Service, ERP administrativo, gestao de unidades, eventos, midia e links. Emporio, Spa e Pacotes Romanticos usam a mesma base modular, sem duplicar aplicacoes por hotel.

O Portal do Hospede usa um template oficial para todas as unidades. Identidade, capas, conteudos e modulos habilitados sao dados por `hotel_id`; a estrutura do portal permanece compartilhada.

O ambiente publicado atual e de desenvolvimento. Producao, Apps Script, planilhas e impressao permanecem fora da plataforma nova.
