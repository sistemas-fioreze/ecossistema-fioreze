# Ecossistema Fioreze

Repositorio oficial da plataforma digital unificada da Familia Fioreze.

## Estrutura

- `legacy/`: copias sanitizadas dos sistemas antigos, separadas por hotel e modulo. E referencia historica e nao deve ser publicada como sistema novo.
- `app/`: plataforma nova compartilhada, com Cloudflare Worker, Workers Static Assets, D1 local, front-end, migrations, seeds, testes e ferramentas.
- `docs/`: documentacao de migracao, regras, operacao e arquitetura.
- `docs/arquitetura/`: contratos da plataforma nova, incluindo estrutura do repositorio, banco, API, autenticacao, impressao e modulos.

## Estado atual

O primeiro hotel e `muller-fioreze`. O primeiro modulo funcional e `room-service`, mas a base nasceu para hospedar Portal do Hospede, Emporio, Spa, Pacotes Romanticos, ERP administrativo unificado e futuros modulos sem duplicar aplicacoes por hotel.

Todo desenvolvimento desta etapa e local. Nao ha deploy, acesso ao D1 remoto, Apps Script, planilhas, servidor de impressao ou impressoras.
