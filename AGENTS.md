# Regras Para Agentes

- `legacy/` e somente referencia e nao deve ser modificado sem autorizacao explicita.
- `app/` sera o sistema novo.
- O primeiro hotel e `muller-fioreze`.
- A futura arquitetura usara Cloudflare Worker, Static Assets e D1.
- O sistema sera multi-hotel com `hotel_id`.
- Nao usar dados reais nos testes.
- Nao acessar producao sem autorizacao.
- Nao imprimir em impressora real durante desenvolvimento.
- Mudancas no banco deverao usar migrations.
- Nao excluir arquivos sem justificar.
- A pasta `Migração Arquivos Room service muller/` e a entrada original e deve permanecer intacta.
- Nao executar HTMLs, Apps Script, servidor de impressao, arquivos `.bat` ou chamadas de producao durante organizacao e analise.
